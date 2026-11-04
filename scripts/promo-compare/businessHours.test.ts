/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// UREN-1 — de ECHTE storefront-api-handler tegen een nep-databank:
//   - get_config / get_storefront_bundle: additief veld config.business_hours (null zonder openingsuren,
//     anders { timezone, week, closures } met enkel de komende sluitingen); de bestaande sleutels blijven;
//   - get_fulfillment_slots: "zelfde als openingsuren" en de sluitingsdagen uit business_hours;
//   - zonder tabel business_hours (fout van de databank): het oude gedrag;
//   - UREN-1b: "buiten de openingsuren niet toestaan" voor afhalen/leveren zonder tijdsloten (outside_hours,
//     OUTSIDE_HOURS) en voor QR aan tafel (checkout_table, table_request_place); standaard toegestaan;
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
  homepage_sections: [], translations: [], products: [], product_categories: [], storefront_carts: [], storefront_cart_items: [], dining_tables: [], dining_areas: [],
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

// --- UREN-1b ------------------------------------------------------------------------------------
// Een week waarin de zaak nooit open is behalve 1 minuut op een andere dag: "nu" is altijd dicht.
const nowLocal = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Brussels', weekday: 'short' }).format(new Date());
const otherDay = String((['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(nowLocal) + 3) % 7);
const CLOSED_WEEK = { [otherDay]: [['10:00', '10:01']] };
const UUID = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;

Deno.test('UREN-1b get_config: table_ordering_when_closed standaard allow, block met de schakelaar', async () => {
  assert((await call('get_config', T)).json.data.business_hours.table_ordering_when_closed === 'allow', 'standaard');
  fs0().qr_block_outside_hours = true;
  try { assert((await call('get_config', T)).json.data.business_hours.table_ordering_when_closed === 'block', 'block'); }
  finally { delete fs0().qr_block_outside_hours; }
});

Deno.test('UREN-1b afhalen zonder tijdsloten: standaard ook buiten de uren (oud gedrag), met de schakelaar OUTSIDE_HOURS', async () => {
  const saved = { week: bh0().week, slots: fs0().slots_enabled };
  bh0().week = CLOSED_WEEK; fs0().slots_enabled = false; fs0().pickup_hours_mode = 'business';
  try {
    const a = (await call('get_fulfillment_slots', T, { type: 'pickup' })).json.data;
    assert(!('outside_hours' in a), `standaard geen extra sleutel: ${JSON.stringify(a)}`);
    fs0().online_block_outside_hours = true;
    const b = (await call('get_fulfillment_slots', T, { type: 'pickup' })).json.data;
    assert(b.outside_hours?.opens_at && /Bestellen kan vanaf/.test(b.outside_hours.message), JSON.stringify(b));
  } finally { bh0().week = saved.week; fs0().slots_enabled = saved.slots; fs0().pickup_hours_mode = null; delete fs0().online_block_outside_hours; }
});

Deno.test('UREN-1b QR aan tafel: standaard toegestaan, met de schakelaar OUTSIDE_HOURS bij checkout_table en table_request_place', async () => {
  const saved = bh0().week;
  bh0().week = CLOSED_WEEK;
  fs0().qr_mode = 'order';
  db.tables.storefront_carts = [{ id: UUID(1), tenant_id: T, expires_at: '2999-01-01T00:00:00Z' }];
  try {
    const ok = (await call('checkout_table', T, { cart_id: UUID(1), table: '4' })).json;
    assert(ok.data?.error?.code !== 'OUTSIDE_HOURS', `standaard toegestaan: ${JSON.stringify(ok).slice(0, 200)}`);
    fs0().qr_block_outside_hours = true;
    const no = (await call('checkout_table', T, { cart_id: UUID(1), table: '4' })).json.data;
    assert(no.success === false && no.error.code === 'OUTSIDE_HOURS' && /Bestellen kan vanaf/.test(no.error.message), JSON.stringify(no));
    const req = (await call('table_request_place', T, { cart_id: UUID(1), request_id: UUID(2), table: '4' })).json.data;
    assert(req.success === false && req.error.code === 'OUTSIDE_HOURS', JSON.stringify(req));
  } finally { bh0().week = saved; delete fs0().qr_block_outside_hours; delete fs0().qr_mode; }
});

Deno.test('GET-stempel UREN-1', async () => {
  const r = await handler(new Request('https://f/storefront-api', { method: 'GET' }));
  assert((await r.json()).version === 'UREN-1' && r.headers.get('X-SellQo-Api-Rev') === 'uren-1', 'stempel');
});
