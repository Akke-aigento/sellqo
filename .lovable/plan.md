
# Volledig Werkende Checkout & Payment Flow

## Analyse - Geïdentificeerde Gaps

Na grondige analyse van de codebase zijn er **4 kritieke issues** die moeten worden opgelost om de checkout flow 100% werkend te krijgen:

---

## Gap 1: Cart Context Ontbreekt (KRITIEK)

**Probleem**: De winkelwagen gebruikt lokale state (`useState<CartItem[]>([])`) in plaats van een gedeelde context. Dit betekent:
- Producten die op de productpagina worden toegevoegd, verschijnen NIET in de winkelwagen
- De checkout pagina heeft altijd een lege cart
- Cart items gaan verloren bij paginanavigatie

**Bestanden betrokken**:
- `src/pages/storefront/ShopProductDetail.tsx:25-28` - alleen toast, geen echte cart update
- `src/pages/storefront/ShopCart.tsx:27` - lokale state
- `src/pages/storefront/ShopCheckout.tsx:68` - lokale state

**Oplossing**: Nieuwe `CartProvider` context met localStorage persistentie

---

## Gap 2: Stripe Success URL Mismatch (KRITIEK)

**Probleem**: De Stripe redirect URLs komen niet overeen met de applicatie routes:

| Component | URL Pattern | Status |
|-----------|-------------|--------|
| Edge Function | `/shop/{tenant_id}/order-success?session_id=...` | FOUT - tenant_id i.p.v. tenantSlug |
| ShopCheckout.tsx | `/shop/{tenantSlug}/order/{ORDER_ID}` | FOUT - placeholder niet vervangen |
| App.tsx Route | `/shop/:tenantSlug/order/:orderId` | CORRECT |

**Problemen**:
1. Edge function gebruikt `tenant_id` (UUID) i.p.v. `tenantSlug` (human-readable)
2. Edge function stuurt naar `/order-success` die niet bestaat
3. `{ORDER_ID}` placeholder in ShopCheckout.tsx wordt niet vervangen

**Oplossing**: 
- Edge function: success_url naar `/shop/{tenantSlug}/order/{orderId}`
- ShopCheckout.tsx wordt niet gebruikt voor Stripe (edge function handelt dit af)

---

## Gap 3: create-bank-transfer-order Request Body Mismatch

**Probleem**: De `ShopCheckout.tsx` stuurt een ander body-formaat dan de edge function verwacht:

**ShopCheckout.tsx stuurt**:
```javascript
{
  tenant_id, 
  items: [{ product_id, quantity, price, name }],  // price i.p.v. unit_price
  customer: customerData,  // genest object
  shipping_cost
}
```

**Edge function verwacht**:
```javascript
{
  tenant_id,
  items: [{ product_id, product_name, quantity, unit_price }],
  customer_email,  // plat veld
  customer_name,   // plat veld
  shipping_address,
  billing_address,
  shipping_cost
}
```

**Oplossing**: Request body in ShopCheckout.tsx aanpassen naar edge function formaat

---

## Gap 4: Realtime Order Status Updates

**Probleem**: Klanten die per bankoverschrijving betalen zien geen update wanneer hun betaling is verwerkt.

**Huidige situatie**: ShopOrderConfirmation laadt order éénmalig bij mount

**Oplossing**: Supabase Realtime subscription toevoegen voor order status changes

---

## Implementatie Plan

### Stap 1: Cart Context & Provider (Nieuw bestand)

Nieuw bestand `src/context/CartContext.tsx`:
- CartProvider component met React Context
- localStorage persistentie voor cart items
- Tenant-specifieke cart (zodat items niet mengen tussen shops)
- Functies: addToCart, updateQuantity, removeItem, clearCart
- Automatische totaalberekening

### Stap 2: App.tsx Wrapper

CartProvider toevoegen rond de storefront routes:
```
<CartProvider>
  <Route path="/shop/:tenantSlug" ... />
  ...
</CartProvider>
```

### Stap 3: ShopProductDetail.tsx Integratie

`handleAddToCart` aanpassen om cart context te gebruiken:
- Import useCart hook
- Aanroep van addToCart met product data
- Optioneel: mini-cart popup of badge update

### Stap 4: ShopCart.tsx Integratie

Lokale state vervangen door cart context:
- Import useCart hook
- Gebruik cartItems, updateQuantity, removeItem van context
- Behoud UI logica

### Stap 5: ShopCheckout.tsx Fixes

1. Cart context integratie
2. Bank transfer request body fix:
```javascript
// Correct formaat voor edge function
{
  tenant_id: tenant.id,
  items: cartItems.map(item => ({
    product_id: item.productId,
    product_name: item.name,
    quantity: item.quantity,
    unit_price: item.price,
  })),
  customer_email: customerData.email,
  customer_name: `${customerData.firstName} ${customerData.lastName}`,
  customer_phone: customerData.phone,
  shipping_address: {
    street: `${customerData.street} ${customerData.houseNumber}`,
    city: customerData.city,
    postal_code: customerData.postalCode,
    country: customerData.country,
  },
  shipping_cost: shipping,
}
```

### Stap 6: create-checkout-session Edge Function Fix

Success URL aanpassen:
```typescript
// Huidige (fout):
success_url: `${origin}/shop/${tenant_id}/order-success?session_id={CHECKOUT_SESSION_ID}`

// Nieuwe (correct):
success_url: `${origin}/shop/${tenantSlug}/order/${order.id}?session_id={CHECKOUT_SESSION_ID}`
```

Dit vereist:
- tenantSlug ophalen of meesturen vanuit frontend
- Of: tenant.slug ophalen uit database

### Stap 7: ShopOrderConfirmation.tsx Realtime Updates

Supabase realtime subscription toevoegen:
```typescript
useEffect(() => {
  if (!orderId) return;
  
  const channel = supabase
    .channel(`order-${orderId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`
    }, (payload) => {
      setOrder(prev => ({ ...prev, ...payload.new }));
    })
    .subscribe();
    
  return () => { supabase.removeChannel(channel); };
}, [orderId]);
```

---

## Bestanden Overzicht

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/context/CartContext.tsx` | NIEUW | Cart provider met localStorage |
| `src/hooks/useCart.ts` | NIEUW | Hook voor cart operaties |
| `src/App.tsx` | WIJZIG | CartProvider wrapper |
| `src/pages/storefront/ShopProductDetail.tsx` | WIJZIG | Cart integratie |
| `src/pages/storefront/ShopCart.tsx` | WIJZIG | Cart context gebruik |
| `src/pages/storefront/ShopCheckout.tsx` | WIJZIG | Cart + correct request format |
| `src/pages/storefront/ShopOrderConfirmation.tsx` | WIJZIG | Realtime updates |
| `supabase/functions/create-checkout-session/index.ts` | WIJZIG | Correcte success URL |

---

## Cart Context Technisch Ontwerp

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CartProvider                                      │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────────────────────┐  │
│  │ localStorage  │◄──│   CartState   │──►│         Functies              │  │
│  │ "cart_{slug}" │   │ - items[]     │   │ - addToCart(product, qty)     │  │
│  └───────────────┘   │ - tenantSlug  │   │ - updateQuantity(id, qty)     │  │
│                      │ - totals      │   │ - removeItem(id)              │  │
│                      └───────────────┘   │ - clearCart()                 │  │
│                                          │ - getCartCount()              │  │
│                                          └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │ShopProduct  │ │  ShopCart   │ │ShopCheckout │
            │Detail.tsx   │ │  .tsx       │ │  .tsx       │
            │             │ │             │ │             │
            │addToCart()  │ │ items       │ │ items       │
            └─────────────┘ │ update/     │ │ payment     │
                            │ remove      │ │ processing  │
                            └─────────────┘ └─────────────┘
```

---

## Prioriteit

1. **P0 - Kritiek**: Cart Context (zonder dit werkt checkout niet)
2. **P0 - Kritiek**: Edge function success URL fix
3. **P1 - Hoog**: Request body format fix
4. **P2 - Medium**: Realtime order updates

Na deze implementatie is de volledige checkout flow functioneel:
- Klant voegt producten toe aan cart
- Cart persisteert tussen pagina's
- Checkout toont werkelijke cart items
- Stripe redirect werkt correct
- Bank transfer order wordt correct aangemaakt
- Order confirmation toont realtime status updates
