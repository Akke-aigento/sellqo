

## Bug: Korting wordt niet meegenomen bij het plaatsen van de bestelling

### Probleem

In `checkoutPlaceOrder` (storefront-api/index.ts, regels 1394-1396) wordt de korting volledig genegeerd:

```typescript
const subtotal = cart.subtotal;           // Origineel subtotaal ZONDER korting
const total = subtotal + shippingCost;    // Korting wordt niet afgetrokken!
```

Terwijl `cartGet` wél correct `cart.discount_amount` en `cart.total` (met korting) berekent. Het gevolg:
- De order wordt opgeslagen met het **volledige bedrag** zonder korting
- Stripe ontvangt de **originele prijzen** zonder korting
- De bevestigingspagina toont het verkeerde bedrag
- De `discount_amount`, `discount_code`, en `discount_code_id` kolommen op de order worden niet ingevuld

### Oplossing

**Bestand: `supabase/functions/storefront-api/index.ts`** — `checkoutPlaceOrder` functie

1. **Gebruik `cart.discount_amount` en `cart.total`** in plaats van alleen `cart.subtotal`:
   - `subtotal = cart.subtotal` (origineel, voor weergave)
   - `discountAmount = cart.discount_amount || 0`
   - `total = cart.total + shippingCost` (cart.total heeft korting al verrekend)

2. **Sla korting op bij de order**:
   - `discount_amount: discountAmount`
   - `discount_code: cart.discount_code || null`
   - Zoek `discount_code_id` op als er een kortingscode is

3. **Pas Stripe line items aan** om de korting te verwerken:
   - Voeg een negatief line item toe voor de korting, OF
   - Pas de `unit_amount` per item aan met de korting proportioneel verdeeld
   - Bij 100% korting: skip Stripe helemaal en markeer order als `paid`

4. **Registreer gebruik** in `discount_code_usage` tabel en verhoog `usage_count`

5. **Order confirmation pagina** (`ShopOrderConfirmation.tsx`):
   - Voeg `discount_amount` en `discount_code` toe aan de query
   - Toon de kortingsregel in het besteloverzicht

### Bestanden

| Bestand | Wijziging |
|---|---|
| `supabase/functions/storefront-api/index.ts` | Fix `checkoutPlaceOrder`: korting meenemen in totaal, opslaan op order, Stripe aanpassen, 0-bedrag orders afhandelen |
| `src/pages/storefront/ShopOrderConfirmation.tsx` | Kortingsregel tonen in besteloverzicht |

