

## Bugfix: Gift card niet zichtbaar in checkout (server-side cart laden)

### Root cause

Wanneer een custom frontend (loveke.be) doorverwijst naar `sellqo.app/shop/{tenant}/checkout?cart_id=...`, laadt de checkout **alleen** items uit de client-side `CartContext` (localStorage). De server-side cart (met de gift card) wordt nooit opgehaald. Omdat sellqo.app en loveke.be verschillende domeinen zijn, is de localStorage van loveke.be niet beschikbaar op sellqo.app.

De sweater verschijnt wel omdat die apart op sellqo.app was toegevoegd (of eerder in localStorage zat). De gift card zit alleen in de server-side cart en wordt dus niet getoond.

### Oplossing

**In `src/pages/storefront/ShopCheckout.tsx`:**

1. **Lees `cart_id` uit de URL query parameters** (net als `cancel_url` al gelezen wordt)

2. **Voeg een useEffect toe die de server-side cart laadt** wanneer `cart_id` aanwezig is:
   - Roep de storefront-api aan: `action: 'cart_get', params: { cart_id }`
   - Map de server items naar het `CartItem` format van CartContext (met `giftCard` metadata)
   - Vervang de client-side cart items met `clearCart()` + `addToCart()` per item
   - Toon een loading state terwijl de cart geladen wordt

3. **Data mapping** van server cart item naar CartContext CartItem:
   ```typescript
   {
     productId: item.product_id,
     name: item.product?.name,
     price: item.unit_price,
     quantity: item.quantity,
     image: item.product?.image,
     variantId: item.variant_id,
     variantTitle: item.variant?.title,
     giftCard: item.gift_card_metadata ? {
       recipientName: item.gift_card_metadata.recipientName,
       recipientEmail: item.gift_card_metadata.recipientEmail,
       personalMessage: item.gift_card_metadata.personalMessage,
       sendDate: item.gift_card_metadata.sendDate,
       designId: item.gift_card_metadata.designId,
     } : undefined,
   }
   ```

4. **Voorkom dubbel laden**: gebruik een `ref` of state flag om te voorkomen dat de cart meerdere keren geladen wordt.

5. **Loading state**: toon een spinner terwijl de server-cart geladen wordt, zodat de gebruiker niet even een lege cart ziet.

### Bestanden
- `src/pages/storefront/ShopCheckout.tsx` — server-side cart laden bij `cart_id` parameter

