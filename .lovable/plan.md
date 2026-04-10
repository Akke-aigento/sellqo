

## Gratis verzending als kortingscode-type toevoegen

### Wat er moet gebeuren

De automatische kortingen ondersteunen al `free_shipping`, maar bij handmatige kortingscodes ontbreekt dit. We voegen het toe als derde optie.

### Aanpassingen

**1. Database migratie** — CHECK constraint uitbreiden
```sql
ALTER TABLE discount_codes DROP CONSTRAINT IF EXISTS discount_codes_discount_type_check;
ALTER TABLE discount_codes ADD CONSTRAINT discount_codes_discount_type_check 
  CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_shipping'));
```

**2. `src/types/discount.ts`** — Type uitbreiden
- `DiscountType` wordt `'percentage' | 'fixed_amount' | 'free_shipping'`

**3. `src/components/admin/DiscountCodeDialog.tsx`** — Formulier aanpassen
- `discount_type` enum uitbreiden met `'free_shipping'`
- Derde optie in de select: "Gratis verzending"
- Bij `free_shipping`: `discount_value` veld verbergen (waarde is irrelevant)
- `discount_value` validatie conditioneel maken (niet verplicht bij free_shipping)

**4. `src/lib/promotions/calculators/discountCode.ts`** — Berekeningslogica
- Bij `discount_type === 'free_shipping'`: geen bedrag-korting toepassen, maar `free_shipping: true` teruggeven in het resultaat

**5. `src/lib/promotions/index.ts`** — Free shipping flag doorvoeren
- Discount code result checken op free_shipping en doorzetten naar het totaalresultaat

**6. `supabase/functions/storefront-api/index.ts`** — API-kant
- In de discount code validatie/toepassing: `free_shipping` type herkennen en verzendkosten op €0 zetten

**7. Kortingsoverzicht (`src/pages/admin/DiscountCodes.tsx` of equivalent)** — Weergave
- Type "free_shipping" tonen als "Gratis verzending" in de lijst

### Bestanden
| Bestand | Wat |
|---------|-----|
| Migratie (nieuw) | CHECK constraint uitbreiden |
| `src/types/discount.ts` | Type toevoegen |
| `src/components/admin/DiscountCodeDialog.tsx` | Formulier + validatie |
| `src/lib/promotions/calculators/discountCode.ts` | Berekeningslogica |
| `src/lib/promotions/index.ts` | Free shipping flag doorvoeren |
| `supabase/functions/storefront-api/index.ts` | API free_shipping afhandeling |
| Kortingsoverzicht pagina | Weergave label |

