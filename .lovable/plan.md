

## Bol.com sync: BTW correct opslaan op nieuwe orders

### Probleem
Inkomende Bol.com orders worden opgeslagen met `tax_amount = 0`, waardoor BTW-rapportages €0 tonen voor alle Bol-omzet. Bol verkoopt B2C inclusief BTW, dus moet de BTW per order uit het totaalbedrag geëxtraheerd worden met het tenant default BTW-percentage.

### Wijzigingen

**1. `supabase/functions/sync-bol-orders/index.ts`**

Binnen de `for (const connection of connections || [])` loop, direct na regel 253 (`const stats = ...`):

```ts
// Load tenant VAT rate for tax calculation on incoming orders
const { data: tenantForTax } = await supabase
  .from('tenants')
  .select('tax_percentage, default_vat_rate')
  .eq('id', connection.tenant_id)
  .single()
const vatRate = Number(tenantForTax?.tax_percentage ?? tenantForTax?.default_vat_rate ?? 21)
```

In de order insert (regel 386-407), `tax_amount` toevoegen direct na `total`:

```ts
subtotal: safeSubtotal,
total: safeSubtotal,
tax_amount: vatRate > 0
  ? Math.round(safeSubtotal * (vatRate / (100 + vatRate)) * 100) / 100
  : 0,
```

**2. `supabase/functions/import-bol-shipments/index.ts`**

> Let op: deze functie heeft geen `for (const connection of connections)` loop — het werkt op één enkele connection die op regel ~199 wordt opgehaald via `connectionId`. De VAT lookup gebeurt dus eenmalig vóór de shipment-loop.

Direct na regel 214 (`console.log('Successfully obtained access token')`), vóór het ophalen van shipments:

```ts
// Load tenant VAT rate for tax calculation on incoming orders
const { data: tenantForTax } = await supabase
  .from('tenants')
  .select('tax_percentage, default_vat_rate')
  .eq('id', connection.tenant_id)
  .single()
const vatRate = Number(tenantForTax?.tax_percentage ?? tenantForTax?.default_vat_rate ?? 21)
```

In de order insert (regel 312-336), `tax_amount` toevoegen direct na `total`:

```ts
subtotal: safeSubtotal,
total: safeSubtotal,
tax_amount: vatRate > 0
  ? Math.round(safeSubtotal * (vatRate / (100 + vatRate)) * 100) / 100
  : 0,
```

### Deploy
Na de edits: `sync-bol-orders` en `import-bol-shipments` Edge Functions herdeployen.

### Niet aanraken
- `subtotal` / `total` waarden zelf (Bol-bedragen blijven SSOT)
- `order_items` inserts (geen line-level tax nodig voor deze fix)
- `sync-shopify-orders`, `sync-woocommerce-orders` (lezen al `total_tax` van bron)
- Reeds historisch via SQL gecorrigeerde orders

### Verificatie (acceptance)
- Bol-order €33,95 totaal @ 21% → `tax_amount = €5,89` ✅
- Bol-order €100 @ 21% → `tax_amount = €17,36` ✅
- Tenant met BTW = 0 (export-only) → `tax_amount = 0`, geen deel-door-nul ✅
- Status, klantgegevens, adressen en items blijven onveranderd ✅

