

## Bugfix: Gift card toont €0 als prijs

### Analyse

De storefront-api `cartAddItem` slaat `unit_price` correct op als `requestedAmount` (regel 1133 + 1169). Dit werkt goed voor nieuwe items. De echte problemen:

1. **Oude items in de DB** met `unit_price = 0` — de fallback in `cartGet` (regel 1092) cascadeert `0 || variant?.price || product?.price || 0`, maar gift cards hebben geen variant en `product.price` kan ook 0 zijn
2. **cartGet fallback** mist `gift_card_metadata.amount` als bron
3. **ShopCheckout/ShopCart** hebben geen prijsfallback voor gift cards met ontbrekende/nul prijs

### Wijzigingen

**1. `supabase/functions/storefront-api/index.ts` — cartGet (regel ~1092)**

Voeg `gift_card_metadata` fallback toe aan de unit_price berekening:

```
unit_price: item.unit_price || item.gift_card_metadata?.amount || variant?.price || item.products?.price || 0,
```

Zelfde voor `line_total` op regel 1097.

**2. `src/pages/storefront/ShopCheckout.tsx` — order summary (regel ~537)**

Voeg prijs-fallback toe voor gift card items in de display:

```typescript
const displayPrice = item.price || (item.giftCard as any)?.amount || 0;
// Gebruik displayPrice * item.quantity i.p.v. item.price * item.quantity
```

**3. `src/pages/storefront/ShopCart.tsx` — item prijs (regel ~188)**

Zelfde fallback voor de prijs-weergave in de winkelwagen:

```typescript
const displayPrice = item.price || (item.giftCard as any)?.amount || 0;
```

En het subtotaal in `CartContext.getSubtotal()` werkt al op `item.price` — als die correct is gezet door `GiftCardPurchaseForm` (dat is het geval: `price: effectiveAmount`), dan is het subtotaal correct. De fallback is alleen nodig voor edge cases waar `price = 0`.

**4. `src/context/CartContext.tsx` — getSubtotal (regel ~154)**

Fallback toevoegen:

```typescript
return items.reduce((sum, item) => {
  const price = item.price || (item.giftCard as any)?.amount || 0;
  return sum + (price * item.quantity);
}, 0);
```

### Bestanden
- `supabase/functions/storefront-api/index.ts` — 2 regels (cartGet unit_price + line_total fallback)
- `src/pages/storefront/ShopCheckout.tsx` — 1 plek (order summary prijs)
- `src/pages/storefront/ShopCart.tsx` — 1 plek (item prijs display)
- `src/context/CartContext.tsx` — 1 plek (getSubtotal fallback)

