

## Fix: checkoutApplyDiscount idempotent maken + prijzen correct doorvoeren

### Probleem
Het Mancini frontend roept achtereenvolgens `cart_apply_discount` en `checkout_apply_discount` aan. De eerste voegt de code toe aan de `discount_codes` array. De tweede ziet dat de code al bestaat en retourneert een fout. Hierdoor worden de checkout-prijzen (discount_amount, shipping_cost, total) niet herberekend.

### Oplossing

**`supabase/functions/storefront-api/index.ts` — `checkoutApplyDiscount` (regel 1936-1937)**

In plaats van een fout teruggeven wanneer de code al in de array zit, gewoon doorgaan met herberekening (idempotent gedrag):

```typescript
// HUIDIG (regel 1936-1937):
if (currentCodes.includes(discountCode)) 
  return { success: false, error: { code: 'DISCOUNT_INVALID', message: 'Deze kortingscode is al toegepast' } };

// NIEUW:
// Als code al in array zit, skip toevoegen maar herbereken wel alles
const updatedCodes = currentCodes.includes(discountCode) 
  ? currentCodes 
  : [...currentCodes, discountCode];
```

Verwijder de `updatedCodes` declaratie op regel 1942 (die wordt nu eerder gedaan).

Dit zorgt ervoor dat:
- Wanneer de code al door `cartApplyDiscount` is toegevoegd, `checkoutApplyDiscount` gewoon de prijzen herberekent en een success-response geeft
- De frontend de correcte subtotal, discount_amount, shipping_cost en total terugkrijgt
- De flow werkt ongeacht of het frontend één of beide calls doet

### Bestanden
| Bestand | Wat |
|---------|-----|
| `supabase/functions/storefront-api/index.ts` | `checkoutApplyDiscount` idempotent maken |

