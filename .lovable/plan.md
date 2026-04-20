

## Per-line VAT in `checkoutVerifyPayment` (storefront-api)

Spiegelt het werk uit `createOrderFromCart` naar het tweede order-creatie pad: de Stripe-checkout verificatie. Helper is al geïmporteerd op regel 4.

### Wijzigingen in `supabase/functions/storefront-api/index.ts`

**Vervang VAT-blok (regel 2208–2213)** door batch-resolve + per-regel berekening met proportionele kortingsverdeling:

```ts
const tenantDefaultRate = Number(tenantData?.default_vat_rate) || 21;
const shippingCost = Number(cart.shipping_cost) || 0;
const discountAmount = Number(cart.discount_amount) || 0;
const total = subtotal - discountAmount + shippingCost;

const vatMap = await resolveLineVatBatch(
  supabase,
  processedItems.map((i: any) => i.product_id),
  tenantDefaultRate
);

const enrichedItems = processedItems.map((item: any) => {
  const lineGross = item.line_total;
  const lineDiscount = (discountAmount > 0 && subtotal > 0)
    ? (lineGross / subtotal) * discountAmount
    : 0;
  const lineNetGross = Math.max(0, lineGross - lineDiscount);
  const { vat_rate, vat_rate_id } = resolveLineVatSync(item.product_id, vatMap, tenantDefaultRate);
  const lineVatAmount = extractVatFromGross(lineNetGross, vat_rate);
  return { item, vat_rate, vat_rate_id, lineVatAmount };
});

const linesVatSum = enrichedItems.reduce((s, e) => s + e.lineVatAmount, 0);
const shippingVat = extractVatFromGross(shippingCost, tenantDefaultRate);
const vatAmount = Math.round((linesVatSum + shippingVat) * 100) / 100;
```

**Vervang `orderItems` map (regel 2266–2271)** door mapping over `enrichedItems` met de VAT-snapshot:

```ts
const orderItems = enrichedItems.map(({ item, vat_rate, vat_rate_id, lineVatAmount }: any) => ({
  order_id: newOrder.id,
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
- `orders.insert(...)` blijft ongewijzigd — gebruikt al `vatAmount`, `subtotal`, `total`, `shippingCost`, `discountAmount`.
- Stripe session retrieve, race-condition handling, customer lookup/insert.
- Stock decrement loop, `record_transaction`, invoice/email triggers.
- `processedItems` blijft de bron voor stock/items.
- `createOrderFromCart` (al gedaan), `stripe-connect-webhook` (volgende prompt).

### Edge cases
- Lege `processedItems` → `enrichedItems = []`, `linesVatSum = 0`, geen crash.
- `subtotal = 0` → discount-allocatie overgeslagen (deel-door-nul-check).
- `tenantDefaultRate = 0` → `extractVatFromGross` retourneert 0, geen NaN.
- Producten zonder `vat_rate_id` → fallback naar tenant default, `vat_rate_id = null` op de regel.

### Acceptance
1. Stripe-checkout Mancini Milano €59,99 → `orders.tax_amount = 10.41`, `order_items.vat_rate = 21.00`, `vat_amount = 10.41`, `vat_rate_id = null`.
2. Multi-item order → som van per-regel VAT klopt op order-niveau.
3. Product met override naar 6%-rij → `order_items.vat_rate = 6.00` met bijbehorend bedrag.
4. TypeScript compileert zonder errors (helper-imports staan al op regel 4).

### Vervolg (out-of-scope)
- `stripe-connect-webhook` (volgende prompt).
- `create-bank-transfer-order`, POS, marketplace syncs.
- Shipping-method-niveau VAT-override.

