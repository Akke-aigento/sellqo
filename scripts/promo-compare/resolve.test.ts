/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// SEC-DOMAIN-2 — test van de ECHTE storefront-resolve-handler tegen een thenable nep-databank.
// Een onverifieerd domein (dns_verified=false) gedraagt zich als een onbekend domein, en staat
// niet in all_domains. Geverifieerde domeinen: zelfde respons als vroeger.
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/resolve.test.ts
import { FakeDb } from './fakeSupabase.ts';

const T = 'tenant-vx';
const dom = (domain: string, extra: Record<string, unknown> = {}) => ({
  id: `d-${domain}`, tenant_id: T, domain, locale: 'nl', is_canonical: false, is_active: true, dns_verified: true, ssl_active: true, ...extra,
});
const db = new FakeDb({
  tenant_domains: [
    dom('shop.example.be', { is_canonical: true }),
    dom('shop.example.nl'),
    dom('vreemd-domein.example', { dns_verified: false, ssl_active: false }), // door de tenant ingevoerd, niet bewezen
    dom('uit.example', { is_active: false }),
  ],
  tenants: [{ id: T, slug: 'vx', name: 'VX', logo_url: null, currency: 'EUR', country: 'BE' }],
  tenant_theme_settings: [{ tenant_id: T, use_custom_frontend: true, custom_frontend_url: null }],
});
(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
await import('../../supabase/functions/storefront-resolve/index.ts');
const handler = (globalThis as any).__serveHandler as (r: Request) => Promise<Response>;

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const get = async (q: string) => { const r = await handler(new Request(`https://f/storefront-resolve${q}`)); return { status: r.status, body: await r.json() }; };
const post = async (b: unknown) => { const r = await handler(new Request('https://f/storefront-resolve', { method: 'POST', body: JSON.stringify(b) })); return { status: r.status, body: await r.json() }; };
const UNKNOWN = { success: false, error: 'Domain not registered', resolved: false };

Deno.test('GET zonder hostname geeft de versiestempel', async () => {
  const r = await get('');
  assert(r.status === 200 && r.body.ok === true && r.body.version === 'SEC-DOMAIN-2', JSON.stringify(r));
});

Deno.test('geverifieerd domein resolvet, all_domains alleen geverifieerd en actief', async () => {
  for (const r of [await get('?hostname=shop.example.nl'), await post({ hostname: 'SHOP.example.nl ' })]) {
    assert(r.status === 200 && r.body.resolved === true && r.body.data.tenant_id === T, JSON.stringify(r));
    assert(JSON.stringify(Object.keys(r.body.data)) === JSON.stringify(['tenant_id', 'tenant_slug', 'tenant_name', 'logo_url', 'currency', 'country', 'locale', 'is_canonical', 'use_custom_frontend', 'custom_frontend_url', 'storefront_api_url', 'all_domains']), 'sleutels ongewijzigd');
    assert(r.body.data.all_domains.map((d: any) => d.domain).join() === 'shop.example.be,shop.example.nl', JSON.stringify(r.body.data.all_domains));
  }
});

Deno.test('onverifieerd domein = onbekend domein (zelfde 404 als een inactief of onbestaand domein)', async () => {
  for (const h of ['vreemd-domein.example', 'uit.example', 'bestaat-niet.example']) {
    const g = await get(`?hostname=${h}`);
    const p = await post({ hostname: h });
    for (const r of [g, p]) assert(r.status === 404 && JSON.stringify(r.body) === JSON.stringify(UNKNOWN), `${h}: ${JSON.stringify(r)}`);
  }
});

Deno.test('GET met lege hostname en POST zonder hostname: 400 zoals vroeger', async () => {
  const g = await get('?hostname=');
  const p = await post({});
  for (const r of [g, p]) assert(r.status === 400 && r.body.error === 'hostname parameter is required', JSON.stringify(r));
});
