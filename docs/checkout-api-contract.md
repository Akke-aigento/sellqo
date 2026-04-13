# SellQo Checkout API Contract

> **Version**: 2.0 — Canonical Rich Cart Response  
> **Last updated**: 2026-04-12

## Principle

The SellQo backend is the **single source of truth** for all checkout state. Custom frontends are "dumb renderers" that display exactly what the backend returns. Frontends **never calculate totals, discounts, or fees**.

## Canonical Cart Response Shape

Every checkout action that modifies cart state returns the **complete** cart display object:

```typescript
interface CartResponse {
  cart_id: string;
  currency: 'EUR';

  // Line items
  items: Array<{
    id: string;            // cart item ID
    product_id: string;
    variant_id: string | null;
    name: string;
    variant: string | null;
    quantity: number;
    unit_price: number;    // EUR, not cents
    line_total: number;    // quantity × unit_price
    image: string | null;
    sku: string | null;
    in_stock: boolean;
  }>;

  // Display-ready amounts (all in EUR)
  subtotal: number;
  shipping_cost: number;
  shipping_method: { id: string; name: string } | null;
  shipping_display_state: 'not_calculated' | 'free' | 'charged';

  // Discount state
  applied_discounts: Array<{
    code: string;
    description: string;
    amount: number;        // EUR
  }>;
  discount_total: number;  // sum of all discount amounts

  // Fee state
  payment_method: string | null;
  fee: {
    label: string;
    amount: number;        // EUR
  } | null;

  // THE ONLY total the frontend should ever display
  total: number;  // subtotal - discount_total + shipping_cost + (fee?.amount || 0)

  // Checkout progress
  checkout_status: 'cart' | 'checkout_started' | 'customer_saved' | 'address_set' | 'shipping_selected' | 'payment_selected' | 'converted';

  // Customer & address data (null until set)
  customer: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
  shipping_address: Record<string, any> | null;
  billing_address: Record<string, any> | null;

  // Available options (pre-filtered, pre-calculated by backend)
  available_shipping_methods: Array<{
    id: string;
    name: string;
    price: number;
    effective_price: number;
    free_above: number | null;
  }>;
  available_payment_methods: Array<{
    method: string;
    group: string;
    name: string;
    description: string;
    fee_cents: number;
    available: boolean;
    reason_unavailable?: string | null;
  }>;

  // Tenant display config
  fee_label: string;
  pass_fee_to_customer: boolean;

  // Tenant-configurable display order of payment sections
  payment_section_order: ('direct' | 'later' | 'transfer')[];
}
```

## Actions That Return This Shape

| Action | Purpose | Returns full CartResponse? |
|--------|---------|--------------------------|
| `checkout_start` | Validate cart, mark as checkout | ✅ |
| `checkout_customer` | Save customer info | ✅ |
| `checkout_address` | Save shipping/billing address | ✅ |
| `checkout_shipping` | Select shipping method | ✅ |
| `checkout_select_payment_method` | Select payment method | ✅ |
| `checkout_apply_discount` | Apply a discount code | ✅ |
| `checkout_remove_discount` | Remove a discount code | ✅ |
| `checkout_complete` | Create Stripe session or bank order | ❌ (returns payment redirect or order) |
| `checkout_verify_payment` | Verify Stripe payment | ❌ (returns order status) |

## Frontend Contract

Custom frontends **MUST**:

1. **Store ONE source of truth**: the last `CartResponse` from any storefront-api action
2. **Display amounts directly** from that response — never recalculate
3. **After any user action** (apply discount, select method, etc.): store the new response and re-render
4. **Never do math on prices** — the `total` field is the only total
5. **Use `shipping_display_state`** to render the shipping line — never interpret `shipping_cost` alone:

```typescript
const shippingDisplay = (() => {
  switch (cart.shipping_display_state) {
    case 'not_calculated': return 'Wordt berekend';
    case 'free': return 'Gratis';
    case 'charged': return formatPrice(cart.shipping_cost);
  }
})();
```

### Example Flow (pseudocode)

```typescript
// 1. Start checkout
let cart = await storefrontApi('checkout_start', { cart_id });
render(cart); // shows items, subtotal, available methods

// 2. Customer fills in info
cart = await storefrontApi('checkout_customer', { cart_id, customer: {...} });
render(cart); // same shape, now with customer filled

// 3. Address
cart = await storefrontApi('checkout_address', { cart_id, shipping_address: {...} });
render(cart); // updated available_payment_methods based on country

// 4. Shipping
cart = await storefrontApi('checkout_shipping', { cart_id, shipping_method_id: '...' });
render(cart); // total now includes shipping_cost

// 5. Discount (optional)
cart = await storefrontApi('checkout_apply_discount', { cart_id, discount_code: 'SAVE10' });
render(cart); // total updated with discount

// 6. Payment method
cart = await storefrontApi('checkout_select_payment_method', { cart_id, payment_method: 'bancontact' });
render(cart); // fee shown if pass_fee_to_customer=true

// 7. Complete
const result = await storefrontApi('checkout_complete', { cart_id, payment_method_id: 'bancontact', success_url, cancel_url });
// result has checkout_url → redirect
```

## API Endpoint

All actions go through a single edge function:

```
POST /functions/v1/storefront-api
Content-Type: application/json

{
  "action": "checkout_start",
  "tenant_id": "<uuid>",
  "params": { "cart_id": "<uuid>" }
}
```

Response:
```json
{
  "success": true,
  "data": { /* CartResponse */ }
}
```

Error response:
```json
{
  "success": false,
  "error": {
    "code": "CART_EMPTY",
    "message": "Cart is empty"
  }
}
```

## Error Codes

| Code | Meaning |
|------|---------|
| `CART_NOT_FOUND` | Cart ID invalid or expired |
| `CART_EMPTY` | No items in cart |
| `VALIDATION_ERROR` | Missing required fields |
| `DISCOUNT_INVALID` | Invalid or expired discount code |
| `SHIPPING_NOT_AVAILABLE` | Shipping method not found |
| `PAYMENT_METHOD_NOT_AVAILABLE` | Payment method not available for this order |
| `TENANT_CONFIG_ERROR` | Tenant configuration issue |
| `ORDER_ALREADY_PAID` | Cart already converted to order |
