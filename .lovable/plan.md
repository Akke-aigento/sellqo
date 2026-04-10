

## Meerdere kortingscodes & free_shipping fix in checkout

### Probleem
1. `storefront_carts.discount_code` is een `text` kolom — elke nieuwe code overschrijft de vorige
2. `checkoutShipping` negeert free_shipping kortingscodes en overschrijft `shipping_cost` terug naar het standaardtarief

### Oplossing

#### 1. Database migratie
- Rename `discount_code` → `discount_codes` als `text[]` array op `storefront_carts`
- Default `'{}'::text[]`

```sql
ALTER TABLE storefront_carts 
  ADD COLUMN discount_codes text[] DEFAULT '{}';

-- Migreer bestaande data
UPDATE storefront_carts 
  SET discount_codes = ARRAY[discount_code] 
  WHERE discount_code IS NOT NULL;

ALTER TABLE storefront_carts 
  DROP COLUMN discount_code;
```

#### 2. Edge function: `storefront-api/index.ts`

**`cartApplyDiscount`** (regel 1332):
- Valideer code, voeg toe aan `discount_codes` array (append, niet overschrijven)
- Check of code al in array zit → fout "Code al toegepast"

**`cartRemoveDiscount`** (regel 1346):
- Accepteer `code` param, verwijder specifieke code uit array

**`checkoutApplyDiscount`** (regel 1893):
- Code toevoegen aan array i.p.v. overschrijven
- Alle actieve codes herberekenen: som van discount amounts, OR van free_shipping flags
- `discount_amount` = som van alle niet-free_shipping codes
- Als minstens 1 code `free_shipping` is → `shipping_cost: 0`

**`checkoutRemoveDiscount`** (regel 1940):
- Accepteer `code` param, verwijder specifieke code uit array
- Herbereken totale discount en shipping na verwijdering

**`checkoutShipping`** (regel 1597):
- Na normale `free_above` berekening: check of `cart.discount_codes` een free_shipping code bevat
- Zo ja → `shippingCost = 0` ongeacht `free_above`

**`checkoutStart`** (regel 1501):
- Return `discount_codes` array in response (i.p.v. single `discount_code`)

**`createOrderFromCart`** (regel 1400):
- `discount_code` op order: `cart.discount_codes?.join(', ')` (comma-separated string, orders tabel blijft text)

**Helper functie** (nieuw):
```typescript
async function recalculateCartDiscounts(supabase, tenantId, cartId, codes, subtotal, currentShippingCost) {
  // Voor elke code: valideer + bereken discount
  // Return { totalDiscount, shippingCost, freeShipping }
}
```

#### 3. `getCartForCheckout` aanpassen
- Lees `discount_codes` i.p.v. `discount_code` (selecteert `*`, dus automatisch mee)

### Bestanden

| Bestand | Wat |
|---------|-----|
| Nieuwe migratie | `discount_code text` → `discount_codes text[]` |
| `supabase/functions/storefront-api/index.ts` | 7 functies aanpassen + helper toevoegen |

### Volgorde
1. Database migratie uitvoeren
2. Edge function aanpassen en deployen

