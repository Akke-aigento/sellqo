// Rooktest storefront-api (R10 in sellqo-engineering-rules): roept de ECHTE functies
// get_products, get_product_filters en computeCartTotals aan tegen een thenable
// nep-databank. Vangt fouten die deno check en unit tests missen, zoals `await` op een
// querybuilder (CATALOG-FILTERS-1, 13-10-2026).
//
// Run (vanuit de repo-root, met netwerk voor de echte imports):
//   cp supabase/functions/storefront-api/index.ts supabase/functions/storefront-api/__smoke.ts
//   echo 'export { getProducts, getProductFilters, computeCartTotals, cartAddItem, getFulfillmentSlots, validateCartFulfillment };' >> supabase/functions/storefront-api/__smoke.ts
//   deno run --allow-read --allow-env --allow-net --no-lock --import-map=scripts/promo-compare/import_map.smoke.json scripts/promo-compare/smoke.ts
//   rm supabase/functions/storefront-api/__smoke.ts
import { FakeDb } from './fakeSupabase.ts';

const S = await import('../../supabase/functions/storefront-api/__smoke.ts');

const T = 'tenant-1';
const cat = { id: 'c1', name: 'Tees', slug: 'tees', hide_from_storefront: false };
const product = (id: string, name: string, price: number, extra: Record<string, unknown> = {}) => ({
  id, tenant_id: T, name, slug: id, description: null, price, compare_at_price: null, images: [], featured_image: null,
  is_active: true, hide_from_storefront: false, track_inventory: true, stock: 5, sku: null, category_id: 'c1', tags: ['zomer'],
  is_featured: false, product_type: 'physical', bundle_pricing_model: null, bundle_discount_value: null,
  created_at: '2026-10-01T00:00:00Z', categories: cat, ...extra,
});
const variant = (pid: string, attrs: Record<string, string>, stock = 3) => ({
  id: `${pid}-${JSON.stringify(attrs)}`, product_id: pid, price: null, stock, track_inventory: true, is_active: true, attribute_values: attrs,
});

const db = new FakeDb({
  products: [product('p1', 'Tee A', 20), product('p2', 'Tee B', 30, { stock: 0 }), product('p3', 'Hoodie', 50)],
  product_variants: [variant('p1', { Maat: 'S' }), variant('p1', { Maat: 'M' }, 0), variant('p3', { Maat: 'L' })],
  categories: [{ ...cat, tenant_id: T }],
  product_categories: [],
  volume_discounts: [], bogo_promotions: [], product_bundles: [], automatic_discounts: [], discount_stacking_rules: [],
  discount_codes: [], customer_groups: [], tenants: [{ id: T, tax_percentage: 21 }],
  // FOOD-1
  shipping_methods: [
    { id: 'sm-pickup', tenant_id: T, name: 'Afhalen', price: 0, is_active: true, fulfillment_type: 'pickup', postal_codes: null, min_order_amount: null },
    { id: 'sm-del', tenant_id: T, name: 'Levering', price: 2.5, is_active: true, fulfillment_type: 'local_delivery', postal_codes: ['3000'], min_order_amount: 15 },
  ],
  product_addon_groups: [
    { id: 'g1', tenant_id: T, name: 'Toppings', min_select: 0, max_select: 2, category_ids: ['c1'], product_ids: [], sort_order: 0, is_active: true },
    { id: 'g2', tenant_id: T, name: 'Saus', min_select: 1, max_select: 1, category_ids: [], product_ids: ['p3'], sort_order: 1, is_active: true },
  ],
  product_addon_options: [
    { id: 'o1', group_id: 'g1', tenant_id: T, name: 'Kaas', price: 1.5, sort_order: 0, is_active: true },
    { id: 'o2', group_id: 'g1', tenant_id: T, name: 'Ham', price: 2, sort_order: 1, is_active: true },
    { id: 'o3', group_id: 'g2', tenant_id: T, name: 'Tomaat', price: 0, sort_order: 0, is_active: true },
  ],
  storefront_carts: [{ id: 'cart1', tenant_id: T, session_id: 's', currency: 'EUR', discount_codes: [], expires_at: '2999-01-01T00:00:00Z' }],
  storefront_cart_items: [],
  fulfillment_settings: [{ tenant_id: T, slots_enabled: true, slot_minutes: 15, prep_minutes: 0, days_ahead: 1, max_orders_per_slot: null, timezone: 'Europe/Brussels',
    hours: { pickup: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [['00:00', '23:45']]])) } }],
  orders: [],
});

let failures = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); console.log(`ok   ${name}`); } catch (e) { failures++; console.error(`FAIL ${name}: ${e instanceof Error ? e.message : e}`); }
}
const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };

await check('get_products default', async () => {
  const r = await S.getProducts(db, T, {});
  assert(r.products.length === 3, `3 producten verwacht, kreeg ${r.products.length}`);
});
await check('get_products category_slug + search', async () => {
  const r = await S.getProducts(db, T, { category_slug: 'tees', search: 'tee' });
  assert(r.products.length === 2, `2 verwacht, kreeg ${r.products.length}`);
});
await check('get_products options + available_only', async () => {
  const r = await S.getProducts(db, T, { options: { Maat: ['M'] }, available_only: true });
  assert(r.products.length === 0, 'M is uitverkocht');
  const r2 = await S.getProducts(db, T, { options: { maat: ['s', 'l'] } });
  assert(r2.pagination.total_count === 2, `2 verwacht, kreeg ${r2.pagination.total_count}`);
});
await check('get_products best_selling', async () => {
  const r = await S.getProducts(db, T, { sort_by: 'best_selling', per_page: 2 });
  assert(r.products.length === 2 && r.pagination.total_count === 3, 'paginering na sortering');
});
await check('get_products ids (SHOP-API-3)', async () => {
  const r = await S.getProducts(db, T, { ids: ['p3', 'p1'] });
  assert(r.products.map((x: { id: string }) => x.id).join(',') === 'p3,p1', `volgorde ${r.products.map((x: { id: string }) => x.id)}`);
  const r2 = await S.getProducts(db, T, { ids: [] });
  assert(r2.products.length === 0, 'lege ids = niets');
});
await check('get_product_filters', async () => {
  const r = await S.getProductFilters(db, T, { category_slug: 'tees' });
  assert(r.total === 3 && r.available === 2, `total/available ${r.total}/${r.available}`);
  assert(r.options[0]?.name === 'Maat', 'optie Maat');
});
await check('computeCartTotals', async () => {
  const r = await S.computeCartTotals(db, T, { discount_codes: [] }, [{ product_id: 'p1', quantity: 2, unit_price: 20, line_total: 40 }]);
  assert(r.subtotal === 40 && r.total === 40, `subtotal/total ${r.subtotal}/${r.total}`);
});

await check('cart_add_item met extra\'s (FOOD-1)', async () => {
  db.writes.length = 0;
  await S.cartAddItem(db, T, { cart_id: 'cart1', product_id: 'p1', addons: ['o2', 'o1'] });
  const ins = db.writes.find((w) => w.table === 'storefront_cart_items' && w.insert)?.insert as Record<string, unknown>;
  assert(ins && ins.unit_price === 23.5 && ins.addons_total === 3.5 && ins.addon_key === 'o1,o2', `insert ${JSON.stringify(ins)}`);
});
await check('cart_add_item zonder extra\'s blijft zoals voorheen', async () => {
  db.writes.length = 0;
  await S.cartAddItem(db, T, { cart_id: 'cart1', product_id: 'p1' });
  const ins = db.writes.find((w) => w.table === 'storefront_cart_items' && w.insert)?.insert as Record<string, unknown>;
  assert(ins && ins.unit_price === 20 && !('addons' in ins) && !('addon_key' in ins), `insert ${JSON.stringify(ins)}`);
});
await check('cart_add_item verplichte groep', async () => {
  let code = '';
  try { await S.cartAddItem(db, T, { cart_id: 'cart1', product_id: 'p3' }); } catch (e) { code = JSON.parse((e as Error).message).code; }
  assert(code === 'ADDON_MIN', `code ${code}`);
});
await check('get_fulfillment_slots', async () => {
  const r = await S.getFulfillmentSlots(db, T, { type: 'pickup' });
  assert(r.enabled && r.slots.length > 0, `slots ${r.slots.length}`);
  const none = await S.getFulfillmentSlots(db, T, { type: 'local_delivery' });
  assert(none.enabled && none.slots.length === 0, 'geen leveruren = geen sloten');
});
await check('validateCartFulfillment', async () => {
  const e1 = await S.validateCartFulfillment(db, T, { shipping_method_id: 'sm-pickup', subtotal: 20 });
  assert(e1?.code === 'SLOT_REQUIRED', `pickup zonder slot: ${e1?.code}`);
  const e2 = await S.validateCartFulfillment(db, T, { shipping_method_id: 'sm-del', subtotal: 20, shipping_address: { postal_code: '2000' } });
  assert(e2?.code === 'DELIVERY_ZONE', `zone: ${e2?.code}`);
  const e3 = await S.validateCartFulfillment(db, T, { shipping_method_id: 'sm-del', subtotal: 10, shipping_address: { postal_code: '3000' } });
  assert(e3?.code === 'MIN_ORDER', `minimum: ${e3?.code}`);
  assert(await S.validateCartFulfillment(db, T, { shipping_method_id: null, subtotal: 1 }) === null, 'gewone verzending ongemoeid');
});

if (failures > 0) { console.error(`${failures} rooktest(en) gefaald`); Deno.exit(1); }
console.log('Rooktest storefront-api groen.');
