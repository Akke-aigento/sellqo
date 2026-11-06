/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// ALLERGEEN-VERKLAARD-1 — de ECHTE storefront-api tegen een nep-databank: `allergens_declared: true`
// verschijnt enkel als de kolom true is; andere producten blijven byte-gelijk (geen sleutel).
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/allergenDeclared.test.ts
import { FakeDb } from './fakeSupabase.ts';

const T = 'tenant-allergen';
const base = { tenant_id: T, is_active: true, hide_from_storefront: false, price: 10, images: [], track_inventory: false, product_type: 'physical', created_at: '2026-10-01T00:00:00Z', categories: null, channels: ['online', 'table', 'menu', 'pos'], sold_out_until: null, stock: 1, is_featured: false };
const db = new FakeDb({
  products: [
    { ...base, id: 'p-none', name: 'Frietjes', slug: 'frietjes', allergens: [], dietary: [], allergens_declared: true },
    { ...base, id: 'p-unknown', name: 'Stoofvlees', slug: 'stoofvlees', allergens: [], dietary: [], allergens_declared: false },
    { ...base, id: 'p-gluten', name: 'Croque', slug: 'croque', allergens: ['gluten'], dietary: [], allergens_declared: true },
    { ...base, id: 'p-legacy', name: 'Oud', slug: 'oud', allergens: [], dietary: [] },
  ],
  tenants: [{ id: T, slug: 'allergen', name: 'Allergeen Test' }],
  tenant_domains: [], tenant_theme_settings: [],
});
(db as any).rpc = () => Promise.resolve({ data: null, error: null });
(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
await import('../../supabase/functions/storefront-api/index.ts');
const handler = (globalThis as any).__serveHandler as (r: Request) => Promise<Response>;
const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const call = async (action: string, params: Record<string, unknown>) => {
  const r = await handler(new Request('https://f/storefront-api', { method: 'POST', body: JSON.stringify({ action, tenant_id: T, params }) }));
  return await r.json();
};

Deno.test('get_products: enkel verklaarde producten krijgen allergens_declared: true', async () => {
  const j = await call('get_products', { per_page: 50 });
  assert(j.success === true && j.data.products.length === 4, JSON.stringify(j).slice(0, 600));
  const by = new Map((j.data.products as any[]).map((p) => [p.id, p]));
  assert(by.get('p-none')?.allergens_declared === true && !('allergens' in by.get('p-none')), JSON.stringify(by.get('p-none')));
  assert(!('allergens_declared' in by.get('p-unknown')) && !('allergens' in by.get('p-unknown')), JSON.stringify(by.get('p-unknown')));
  assert(by.get('p-gluten')?.allergens_declared === true && by.get('p-gluten')?.allergens?.[0] === 'gluten', JSON.stringify(by.get('p-gluten')));
  assert(!('allergens_declared' in by.get('p-legacy')), 'zonder kolom: geen sleutel');
});

Deno.test('get_product: zelfde regel', async () => {
  const yes = await call('get_product', { slug: 'frietjes' });
  assert(yes.data?.allergens_declared === true, JSON.stringify(yes).slice(0, 400));
  const no = await call('get_product', { slug: 'stoofvlees' });
  assert(no.success === true && !('allergens_declared' in no.data), JSON.stringify(no).slice(0, 400));
});

Deno.test('GET-stempel TAFEL-SAMEN-1', async () => {
  const r = await handler(new Request('https://f/storefront-api', { method: 'GET' }));
  assert((await r.json()).version === 'TAFEL-SAMEN-1' && r.headers.get('X-SellQo-Api-Rev') === 'tafel-samen-1', 'stempel');
});
