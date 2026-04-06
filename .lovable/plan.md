
## Fix: lege IBAN/BIC op QR-pagina

### Wat er echt fout gaat
Dit is geen QR-render probleem meer. De bankgegevens zijn leeg omdat de backend-query in `storefront-api` stuk is.

Ik heb bevestigd:

- In de database bestaan de tenant-velden wél:
  - `iban`
  - `bic`
  - `name`
- Voor VanXcel staan daar ook echte waarden in.
- De frontend van VanXcel gebruikt voor checkout **niet** `create-bank-transfer-order`, maar:
  ```text
  VanXcel frontend
    -> sellqo-proxy
    -> storefront-api
    -> action: checkout_complete
  ```
- In `checkoutComplete` doet `storefront-api` nu:
  ```ts
  .select('default_vat_rate, stripe_account_id, iban, bic, name, currency')
  ```
- Maar kolom `default_vat_rate` bestaat niet in `public.tenants`.

Daardoor faalt die tenant-query. Omdat de code de fout niet controleert, wordt `tenantData` gewoon `undefined` en vallen deze regels terug op lege strings:

```ts
const iban = tenantData?.iban || '';
const bic = tenantData?.bic || '';
const name = tenantData?.name || '';
```

Dat matcht exact met je screenshot en de logs:
```text
QR EPC payload data: { iban: "", bic: "", name: "", amount: "10.00", ref: "#1159" }
```

### Bestanden die aangepast moeten worden

| Bestand | Wijziging |
|---|---|
| `supabase/functions/storefront-api/index.ts` | Foute tenant select in `checkoutComplete` corrigeren + query error expliciet afhandelen |

### Concrete fix

In `checkoutComplete`:

**Van**
```ts
const { data: tenantData } = await supabase
  .from('tenants')
  .select('default_vat_rate, stripe_account_id, iban, bic, name, currency')
  .eq('id', tenantId).single();
```

**Naar**
```ts
const { data: tenantData, error: tenantError } = await supabase
  .from('tenants')
  .select('tax_percentage, stripe_account_id, iban, bic, name, currency')
  .eq('id', tenantId)
  .single();

if (tenantError || !tenantData) {
  console.error('checkoutComplete tenant query failed:', tenantError);
  return {
    success: false,
    error: {
      code: 'TENANT_CONFIG_ERROR',
      message: 'Winkelconfiguratie voor betaling kon niet geladen worden',
    },
  };
}
```

### Waarom dit de juiste fix is
- `tax_percentage` is de echte kolom in `tenants`
- Daardoor slaagt de tenant-query opnieuw
- `tenantData.iban`, `tenantData.bic` en `tenantData.name` worden weer gevuld
- `bank_details` in de API response bevat dan echte waarden
- De EPC payload wordt dan opgebouwd met:
  ```text
  regel 5 = BIC
  regel 6 = naam
  regel 7 = IBAN
  regel 11 = bestelnummer
  ```

### Extra robuustheid
Ik zou tegelijk ook 2 kleine veiligheidsfixes meenemen:

1. **Controleer query errors altijd expliciet** in `checkoutComplete`
2. **Zoek in `storefront-api/index.ts` naar alle `default_vat_rate` selects op `tenants`**
   - waar het enkel response-mapping is, vervangen door `tax_percentage`
   - waar het enkel output-naam is (`vat_rate` in config), kan de outputnaam blijven, maar de bron moet `tax_percentage` zijn

### Verwacht resultaat na implementatie
Op de QR-betaalpagina en in de bankapp zie je dan:

- Rekeninghouder: `VanXcel`
- IBAN: `BE41739022737710`
- BIC: `KREDBEBBXXX`
- Bedrag: correct
- Mededeling: bestelnummer

### Technisch detail
De fout zat dus niet in:
- `ShopQRPayment.tsx`
- de EPC QR structuur
- de tenant-data in de database

De fout zit specifiek in deze backend-keten:

```text
VanXcel checkout
  -> sellqo-proxy (/checkout/complete)
  -> storefront-api action checkout_complete
  -> SELECT op tenants met niet-bestaande kolom default_vat_rate
  -> tenantData undefined
  -> bank_details leeg
  -> QR payload leeg
```
