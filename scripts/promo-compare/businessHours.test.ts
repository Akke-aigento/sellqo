/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// UREN-1 — de ECHTE storefront-api-handler tegen een nep-databank:
//   - get_config / get_storefront_bundle: additief veld config.business_hours (null zonder openingsuren,
//     anders { timezone, week, closures } met enkel de komende sluitingen); de bestaande sleutels blijven;
//   - get_fulfillment_slots: "zelfde als openingsuren" en de sluitingsdagen uit business_hours;
//   - zonder tabel business_hours (fout van de databank): het oude gedrag;
//   - GET-stempel UREN-1.
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/businessHours.test.ts
import { FakeDb } from './fakeSupabase.ts';

const T = 'tenant-uren';
const NONE = 'tenant-zonder-uren';
const allDays = (r: [string, string][]) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), r]));
const db = new FakeDb({
  tenants: [{ id: T, slug: 'uren', name: 'Uren', currency: 'EUR' }, { id: NONE, slug: 'geen', name: 'Geen', currency: 'EUR' }],
  tenant_theme_settings: [], tenant_domains: [], storefront_config: [], storefront_pages: [], categories: [], legal_pages: [],
  homepage_sections: [], translations: [], products: [], product_categories: [],
  fulfillment_settings: [{ tenant_id: T, slots_enabled: true, slot_minutes: 60, prep_minutes: 0, days_ahead: 1, max_orders_per_slot: null,
    timezone: 'Europe/Brussels', hours: { pickup: allDays([['09:00', '10:00']]) }, pickup_hours_mode: null, delivery_hours_mode: null }],
  business_hours: [{ tenant_id: T, timezone: 'Europe/Brussels', week: allDays([['00:00', '23:00']]),
    closures: [{ from: '2000-01-01', to: '2000-01-02', reason: 'Lang geleden' }, { from: '2999-12-24', to: '2999-12-26', reason: 'Kerst' }] }],
  orders: [],
});

(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
await import('../../supabase/functions/storefront-api/index.ts');
const handler = (globalThis as any).__serveHandler as (r: Request) => Promise<Response>;

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const call = async (action: string, tenant_id: string, params: Record<string, unknown> = {}) => {
  const r = await handler(new Request('https://f/storefront-api', { method: 'POST', body: JSON.stringify({ action, tenant_id, params }) }));
  return { status: r.status, json: await r.json() };
};
const fs0 = () => db.tables.fulfillment_settings[0];
const bh0 = () => db.tables.business_hours[0];

Deno.test('get_config: business_hours met week, tijdzone en enkel komende sluitingen', async () => {
  const d = (await call('get_config', T)).json.data;
  assert(d.business_hours?.timezone === 'Europe/Brussels', JSON.stringify(d.business_hours));
  assert(JSON.stringify(d.business_hours.week['1']) === '[["00:00","23:00"]]', 'week');
  assert(JSON.stringify(d.business_hours.closures) === '[{"from":"2999-12-24","to":"2999-12-26","reason":"Kerst"}]', JSON.stringify(d.business_hours.closures));
  // Eerste wet: de bestaande sleutels blijven, het nieuwe veld staat achteraan.
  const keys = Object.keys(d);
  assert(JSON.stringify(keys) === JSON.stringify(['store', 'contact', 'social', 'languages', 'canonical_domain', 'features', 'payments', 'appearance', 'business_hours']), JSON.stringify(keys));
});

Deno.test('get_config: zonder openingsuren → business_hours null', async () => {
  const d = (await call('get_config', NONE)).json.data;
  assert('business_hours' in d && d.business_hours === null, JSON.stringify(d.business_hours));
});

Deno.test('get_storefront_bundle: business_hours zit in config', async () => {
  const d = (await call('get_storefront_bundle', T)).json.data;
  assert(d.config.business_hours?.week?.['0'], JSON.stringify(d.config.business_hours));
});

Deno.test('get_fulfillment_slots: bestaande eigen afhaaluren blijven (geen keuze), leveren volgt de openingsuren', async () => {
  const p = (await call('get_fulfillment_slots', T, { type: 'pickup' })).json.data;
  assert(p.enabled && p.slots.every((x: any) => x.label === '09:00'), JSON.stringify(p.slots.map((x: any) => x.label)));
  const l = (await call('get_fulfillment_slots', T, { type: 'local_delivery' })).json.data;
  assert(l.enabled && l.slots.length > 1 && l.slots.some((x: any) => x.label !== '09:00'), `levering ${l.slots.length}`);
});

Deno.test('get_fulfillment_slots: "zelfde als openingsuren" voor afhalen', async () => {
  fs0().pickup_hours_mode = 'business';
  try {
    const p = (await call('get_fulfillment_slots', T, { type: 'pickup' })).json.data;
    assert(p.slots.length > 1 && p.slots.some((x: any) => x.label === '22:00'), JSON.stringify(p.slots.map((x: any) => x.label)));
  } finally { fs0().pickup_hours_mode = null; }
});

Deno.test('get_fulfillment_slots: sluitingsdag vandaag en morgen → geen sloten en blocked closed_today', async () => {
  const saved = bh0().closures;
  bh0().closures = [{ from: '2000-01-01', to: '2999-01-01', reason: 'Verbouwing' }];
  try {
    const p = (await call('get_fulfillment_slots', T, { type: 'pickup' })).json.data;
    assert(p.slots.length === 0 && p.blocked?.reason === 'closed_today', JSON.stringify(p));
  } finally { bh0().closures = saved; }
});

Deno.test('zonder tabel business_hours (databankfout): oud gedrag, geen business_hours-veld-fout', async () => {
  const realFrom = (db as any).from.bind(db);
  (db as any).from = (t: string) => {
    if (t !== 'business_hours') return realFrom(t);
    const q: any = { select: () => q, eq: () => q, maybeSingle: () => Promise.resolve({ data: null, error: { code: '42P01', message: 'relation does not exist' } }) };
    return q;
  };
  try {
    const p = (await call('get_fulfillment_slots', T, { type: 'local_delivery' })).json.data;
    assert(p.enabled && p.slots.length === 0, 'levering zonder eigen uren: zoals vroeger geen sloten');
    const d = (await call('get_config', T)).json.data;
    assert(d.business_hours === null, 'veld blijft null');
  } finally { (db as any).from = realFrom; }
});

Deno.test('GET-stempel UREN-1', async () => {
  const r = await handler(new Request('https://f/storefront-api', { method: 'GET' }));
  assert((await r.json()).version === 'UREN-1' && r.headers.get('X-SellQo-Api-Rev') === 'uren-1', 'stempel');
});
