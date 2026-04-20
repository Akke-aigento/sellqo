

## Per-line VAT in `createOrderFromCart` (storefront-api)

Refactor de eerste order-creatie pad in `supabase/functions/storefront-api/index.ts` zodat BTW per regel wordt geresolved en als snapshot wordt opgeslagen op `order_items`. Het tweede pad (Stripe session, ~regel 2140) blijft buiten scope.

### Wijzigingen in `supabase/functions/storefront-api/index.ts`

**1. Import toevoegen (top van het bestand, na regel 3)**

```ts
import { resolveLineVatBatch, resolveLineVatSync, extractVatFromGross } from '../_shared/vat.ts';
```

**2. Refactor binnen `createOrderFromCart` (regel 1548–1632)**

Vervang het `vatAmount`-blok (regel 1558–1564) door een per-regel berekening, en verrijk de `orderItems` map (regel 1619–1630) met de VAT-snapshot.

Nieuwe flow tussen tenant-fetch en customer-lookup:

```ts
const tenantDefaultRate = Number(tenant?.tax_percentage) || 21;
const subtotal = Number(cart.subtotal) || 0;
const shippingCost = Number(cart.shipping_cost) || 0;
const discountAmount = Number(cart.discount_amount) || 0;
const total = subtotal - discountAmount + shippingCost;

const cartItems: any[] = Array.isArray(cart.cartItems) ? cart.cartItems : [];

// Batch-resolve VAT for all product_ids in one query (avoids N+1)
const vatMap = await resolveLineVatBatch(
  supabase,
  cartItems.map((i) => i.product_id),
  tenantDefaultRate
);

// Per-line: proportional discount allocation + inclusive VAT extraction
const enrichedItems = cartItems.map((item: any) => {
  const qty = Number(item.quantity) || 0;
  const unit = Number(item.unit_price) || 0;
  const lineGross = qty * unit;
  const lineDiscount = (discountAmount > 0 && subtotal > 0)
    ? (lineGross / subtotal) * discountAmount
    : 0;
  const lineNetGross = Math.max(0, lineGross - lineDiscount);

  const { vat_rate, vat_rate_id } = resolveLineVatSync(item.product_id, vatMap, tenantDefaultRate);
  const lineVatAmount = extractVatFromGross(lineNetGross, vat_rate);

  return { item, vat_rate, vat_rate_id, lineVatAmount };
});

// Order-level VAT = sum of line VATs + shipping VAT (tenant default rate for now)
const linesVatSum = enrichedItems.reduce((s, e) => s + e.lineVatAmount, 0);
const shippingVat = extractVatFromGross(shippingCost, tenantDefaultRate);
const vatAmount = Math.round((linesVatSum + shippingVat) * 100) / 100;
```

`total`, `subtotal`, `discountAmount`, `shippingCost` blijven exact zoals nu — alleen `tax_amount` op het order-niveau verandert van bron-formule.

**3. `orderItems` map verrijken (regel 1619–1630)**

```ts
const orderItems = enrichedItems.map(({ item, vat_rate, vat_rate_id, lineVatAmount }) => ({
  order_id: order.id,
  product_id: item.product_id,
  product_name: item.product?.name || '',
  quantity: item.quantity,
  unit_price: item.unit_price,
  total_price: item.line_total,
  product_sku: item.product?.sku || null,
  product_image: item.product?.image || null,
  variant_id: item.variant_id || null,
  variant_title: item.variant?.title || null,
  vat_rate,
  vat_rate_id,
  vat_amount: Math.round(lineVatAmount * 100) / 100,
}));
```

### Niet aanraken
- `subtotal`, `total`, `discount_amount` op de `orders`-insert (klantbedrag onveranderd).
- Stripe payment-flow, customer lookup/insert, cart-conversie, discount-usage increment.
- Het tweede order-creatie pad rond regel 2140 (Stripe session handler) — separate vervolgprompt.
- Andere functies in het bestand.
- Geen DB-migratie, geen RLS, geen types.

### Edge cases gedekt
- Lege cart of cart zonder geldige `product_id`'s → `enrichedItems = []`, `linesVatSum = 0`, geen crash.
- `subtotal = 0` → discount-allocatie wordt overgeslagen (deel-door-nul-check).
- `tenantDefaultRate = 0` (export-only) → `extractVatFromGross` retourneert `0`, geen NaN.
- Producten zonder `vat_rate_id` → `resolveLineVatSync` valt terug op `tenantDefaultRate`, `vat_rate_id = null` op de regel.

### Acceptance verificatie
1. Mancini Milano €59,99 zonder discount → `orders.tax_amount = 10.41`, `order_items.vat_rate = 21.00`, `vat_amount = 10.41`, `vat_rate_id = null`.
2. Product met override naar 6%-rij → `order_items.vat_rate = 6.00` met bijbehorend bedrag.
3. Subtotal €100 (€60 + €40), discount €10 → line VAT op €54 en €36 net.
4. Lege cart → `vatAmount = 0`, geen errors.

### Vervolg (out-of-scope)
- Tweede order-creatie pad rond regel 2140 (Stripe session).
- `stripe-connect-webhook`, `create-bank-transfer-order`, POS, marketplace syncs.
- Shipping-method-niveau VAT-override (nu nog tenant default).

