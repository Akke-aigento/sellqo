

## Per-line VAT in `create-bank-transfer-order`

Vierde en laatste online order-creatie pad. Behoudt de bestaande inclusive/exclusive modus en de regulatoire VAT-typering (standard / reverse_charge / export); enkel de berekening verandert van één tariefformule naar per-regel resolutie.

### Wijzigingen in `supabase/functions/create-bank-transfer-order/index.ts`

**1. Import toevoegen (na regel 2)**

```ts
import { resolveLineVatBatch, resolveLineVatSync, extractVatFromGross } from "../_shared/vat.ts";
```

**2. Per-regel VAT-resolutie toevoegen tussen `vatType`-detectie en `totalAmount` (na regel 248)**

```ts
const effectiveTenantRate = (vatType === 'reverse_charge' || vatType === 'export') ? 0 : vatRate;

const vatMap = await resolveLineVatBatch(
  supabaseClient,
  verifiedItems.map((i: any) => i.product_id),
  effectiveTenantRate
);

const enrichedItems = verifiedItems.map((item: any) => {
  const lineGross = (item.unit_price || 0) * (item.quantity || 0);
  const { vat_rate, vat_rate_id } = (vatType === 'reverse_charge' || vatType === 'export')
    ? { vat_rate: 0, vat_rate_id: null }
    : resolveLineVatSync(item.product_id, vatMap, effectiveTenantRate);
  return { item, vat_rate, vat_rate_id, lineGross, lineVatAmount: 0 };
});
```

**3. Vervang `vatAmount`/`total` blok (regel 255–272)** door per-regel inclusive/exclusive berekening:

```ts
let vatAmount = 0;
let total: number;

if (vatHandling === 'inclusive') {
  const linesVat = enrichedItems.reduce((s: number, e: any) =>
    s + extractVatFromGross(e.lineGross, e.vat_rate), 0);
  const shippingVat = extractVatFromGross(shipping_cost, effectiveTenantRate);
  vatAmount = Math.round((linesVat + shippingVat) * 100) / 100;
  total = totalAmount;
  logStep("Inclusive VAT - extracted per line", { linesVat, shippingVat, vatAmount, total });
} else {
  const linesVat = enrichedItems.reduce((s: number, e: any) =>
    s + (e.lineGross * (e.vat_rate / 100)), 0);
  const shippingVat = shipping_cost * (effectiveTenantRate / 100);
  vatAmount = Math.round((linesVat + shippingVat) * 100) / 100;
  total = Math.round((totalAmount + vatAmount) * 100) / 100;
  logStep("Exclusive VAT - added per line", { linesVat, shippingVat, vatAmount, total });
}

// Persist per-line VAT amount for order_items insert
for (const e of enrichedItems) {
  e.lineVatAmount = (vatHandling === 'inclusive')
    ? extractVatFromGross(e.lineGross, e.vat_rate)
    : e.lineGross * (e.vat_rate / 100);
}
```

**4. Vervang `orderItems` map (regel 338–348)** door mapping over `enrichedItems`:

```ts
const orderItems = enrichedItems.map((e: any) => ({
  order_id: order.id,
  product_id: e.item.product_id,
  product_name: e.item.product_name,
  product_sku: e.item.product_sku,
  product_image: e.item.product_image,
  quantity: e.item.quantity,
  unit_price: e.item.unit_price,
  total_price: e.item.unit_price * e.item.quantity,
  vat_rate: e.vat_rate,
  vat_rate_id: e.vat_rate_id,
  vat_amount: Math.round(e.lineVatAmount * 100) / 100,
}));
```

### Niet aanraken
- `vatType` detectie (standard / reverse_charge / export) en `vatText` / `taxCategoryCode`.
- OSS / B2B VAT-nummer validatie en EU-country check.
- `subtotal`, `totalAmount`, `shipping_cost`, `vatHandling` bron-velden.
- Order-level `orders.insert(...)` velden `vat_type`, `vat_rate`, `vat_country`, `vat_text`, `customer_vat_number`, `ogm_reference`.
- Bank details / OGM / QR generatie en response payload.
- `record_transaction` aanroep.

### Edge cases
- Reverse charge / export → alle regels geforceerd op `vat_rate = 0`, `vat_rate_id = null`, ongeacht productinstelling.
- Lege `verifiedItems` → `enrichedItems = []`, `vatAmount = 0`, geen crash.
- `effectiveTenantRate = 0` → `extractVatFromGross` retourneert 0 (geen NaN), exclusive multiplier = 0.
- Producten zonder `vat_rate_id` (standard mode) → fallback naar `effectiveTenantRate` via `resolveLineVatSync`.

### Acceptance
1. VanXcel inclusive 21% €100 → `tax_amount = 17.36`, `total = 100` (regressie identiek).
2. Mixed-rate (6% + 21%) inclusive → som van per-regel extracted VAT klopt, `total = totalAmount` ongewijzigd.
3. B2B reverse charge met geldig VAT-nummer → alle `order_items.vat_rate = 0`, `vatAmount = 0`, ongeacht product `vat_rate_id`.
4. Export (non-EU) → alle regels `vat_rate = 0`.
5. Exclusive mode met multi-rate → VAT correct per regel toegevoegd, `total = totalAmount + vatAmount`.

### Vervolg (out-of-scope)
- POS order-creatie, `sync-bol-orders`, `import-bol-shipments`.
- Shipping-method-niveau VAT-override.

