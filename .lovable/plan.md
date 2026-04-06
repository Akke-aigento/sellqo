

## Fix: Dubbele `.from('tenants')` query in checkoutPlaceOrder

### Root cause

**Regel 1388-1389** bevat twee opeenvolgende `.from('tenants').select(...)` calls:

```typescript
const { data: tenant } = await supabase
  .from('tenants').select('default_vat_rate, currency, stripe_account_id, iban, bic, name')
  .from('tenants').select('default_vat_rate, currency, name, iban')
  .eq('id', tenantId).single();
```

De tweede `.from().select()` **overschrijft** de eerste. Het resultaat is dat de query alleen `default_vat_rate, currency, name, iban` ophaalt. De kolommen `stripe_account_id`, `bic` ontbreken in het resultaat.

Later in de functie (regel 1776-1782) wordt `tenant` gebruikt voor `bank_details` in de fallback return. Hier ontbreekt `bic` omdat het niet in de query zat. En `stripe_account_id` ontbreekt, wat Stripe checkout kan breken als die via deze codepath loopt.

De code op regel 1634-1636 (`checkoutComplete`) haalt tenant data apart op met de correcte select — die werkt wel. Dus de QR payload op regel 1735-1754 gebruikt `tenantData` (correct). Maar de fallback return op regel 1776-1782 gebruikt `tenant` (de gebroken query).

### Fix

**`supabase/functions/storefront-api/index.ts`** — regels 1387-1390:

Verwijder de dubbele `.from().select()` en combineer tot één correcte query:

```typescript
const { data: tenant } = await supabase
  .from('tenants').select('default_vat_rate, currency, stripe_account_id, iban, bic, name')
  .eq('id', tenantId).single();
```

### Bestanden

| Bestand | Actie |
|---|---|
| `supabase/functions/storefront-api/index.ts` | Verwijder dubbele `.from('tenants')` query op regel 1388-1389 |

### Geen database wijzigingen nodig
De kolommen `iban`, `bic`, `name` bestaan in de `tenants` tabel en zijn correct gevuld voor VanXcel.

