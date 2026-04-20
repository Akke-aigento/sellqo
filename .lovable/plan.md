

## Per-line VAT in `stripe-connect-webhook`

Spiegelt het per-regel VAT-patroon van de twee storefront-api paden naar de Stripe Connect webhook (derde en laatste online order-creatie pad). `supabaseClient` blijft de client variabele.

### Wijzigingen in `supabase/functions/stripe-connect-webhook/index.ts`

**1. Import toevoegen (na regel 3)**

```ts
import { resolveLineVatBatch, resolveLineVatSync, extractVatFromGross } from "../_shared/vat.ts";
```

**2. Vervang VAT-blok (regel 325–330)** door batch-resolve + per-regel berekening met proportionele kortingsverdeling. `processedItems` (regel 307) en `subtotal` (regel 318) zijn al beschikbaar; `tenant` (regel 321) ook.

```ts
const tenantDefaultRate = Number(tenant?.default_vat_rate) || 21;
const shippingCost = Number(cart.shipping_cost) || 0;
const discountAmount = Number(cart.discount_amount) || 0;
const total = subtotal - discountAmount + shippingCost;

const vatMap = await resolveLineVatBatch(
  supabaseClient,
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

const linesVatSum = enrichedItems.reduce((s: number, e: any) => s + e.lineVatAmount, 0);
const shippingVat = extractVatFromGross(shippingCost, tenantDefaultRate);
const vatAmount = Math.round((linesVatSum + shippingVat) * 100) / 100;
```

`orders.insert(...)` (regel 353–378) blijft ongewijzigd — gebruikt al `vatAmount`, `subtotal`, `shippingCost`, `discountAmount`, `total`.

**3. Vervang `orderItems` map (regel 388–399)** door mapping over `enrichedItems` met VAT-snapshot:

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
await supabaseClient.from("order_items").insert(orderItems);
```

### Niet aanraken
- Stripe signature verification, event dispatch, payout/account.updated handlers.
- `processedItems` constructie (regel 300–316) en `subtotal` (regel 318).
- Klant lookup/insert, `generate_order_number`, stock decrement loop, invoice/email triggers, cart-conversie.
- Andere edge functions (`create-bank-transfer-order`, POS, marketplace syncs) — separate vervolgprompts.
- Geen DB-migratie, geen RLS, geen types.

### Edge cases (door helper afgedekt)
- Lege `processedItems` → `enrichedItems = []`, `linesVatSum = 0`, geen crash.
- `subtotal = 0` → discount-allocatie overgeslagen (deel-door-nul-check).
- `tenantDefaultRate = 0` → `extractVatFromGross` retourneert 0, geen NaN.
- Producten zonder `vat_rate_id` → fallback naar tenant default, `vat_rate_id = null` op de regel.

### Acceptance
1. Stripe Connect webhook fires voor Mancini Milano €59,99 cart → `orders.tax_amount = 10.41`, `order_items.vat_rate = 21.00`, `vat_amount = 10.41`, `vat_rate_id = null` — identiek aan beide andere paden.
2. Multi-item order → som van per-regel VAT klopt op order-niveau.
3. Product met `vat_rate_id` override naar 6%-rij → `order_items.vat_rate = 6.00` met bijbehorend bedrag.
4. TypeScript compileert; `supabaseClient` consistent gebruikt.

### Vervolg (out-of-scope)
- `create-bank-transfer-order`, POS order-creatie, `sync-bol-orders`, `import-bol-shipments`.
- Shipping-method-niveau VAT-override.

