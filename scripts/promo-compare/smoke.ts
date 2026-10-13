// Rooktest storefront-api (R10 in sellqo-engineering-rules): roept de ECHTE functies
// get_products, get_product_filters en computeCartTotals aan tegen een thenable
// nep-databank. Vangt fouten die deno check en unit tests missen, zoals `await` op een
// querybuilder (CATALOG-FILTERS-1, 13-10-2026).
//
// Run (vanuit de repo-root, met netwerk voor de echte imports):
//   cp supabase/functions/storefront-api/index.ts supabase/functions/storefront-api/__smoke.ts
//   echo 'export { getProducts, getProductFilters, computeCartTotals };' >> supabase/functions/storefront-api/__smoke.ts
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
  discount_codes: [], customer_groups: [], shipping_methods: [], tenants: [{ id: T, tax_percentage: 21 }],
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

if (failures > 0) { console.error(`${failures} rooktest(en) gefaald`); Deno.exit(1); }
console.log('Rooktest storefront-api groen.');
