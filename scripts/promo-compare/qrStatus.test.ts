/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// QR-IDEMP-1 / STATUS-1 / OBER-ROEPEN-1 — de ECHTE storefront-api-handler tegen een nep-databank:
//   - checkout_complete op een al omgezet mandje → hetzelfde succes als de eerste keer (duplicate),
//     enkel met de order van dít mandje; anders de oude fout;
//   - table_check_pay met release_payment_ids → oude pogingen op dezelfde tafel vrijgegeven;
//   - table_request_status: oud antwoord + progress, lijst, order, oproepen; nooit andere tenants;
//   - table_call: invoer, aan/uit, tafel via QR-token, foutcodes, IP-rem;
//   - QR-MODULES-1: oproepen per soort aan/uit (TABLE_CALL_KIND_OFF) en call_kinds in table_request_status.
// De databankfuncties zelf (table_call_place-rem, idempotentie) worden live getest.
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/qrStatus.test.ts
import { FakeDb } from './fakeSupabase.ts';

const T = 'tenant-qr2';
const OTHER = 'tenant-other';
const TOKEN = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const TABLE = '44444444-4444-4444-8444-444444444444';
const u = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const CART_PICKUP = u(1), CART_STRIPE = u(2), CART_BANK = u(3), CART_NOLINK = u(4), CART_FOREIGN = u(5);
const ORD_PICKUP = u(11), ORD_STRIPE = u(12), ORD_BANK = u(13), ORD_FOREIGN = u(15), ORD_KITCHEN = u(16);
const REQ_PENDING = u(21), REQ_ACCEPTED = u(22), REQ_OTHER_TENANT = u(23);
const LINE_A = u(31), LINE_B = u(32);
const ROUND = u(41);
const ST_KITCHEN = u(51), ST_BAR = u(52);
const PAY_OLD = u(61), PAY_OTHER_TABLE = u(62), PAY_NEW = u(63);
const CALL = u(71);

const cart = (id: string, extra: Record<string, unknown>) => ({ id, tenant_id: T, checkout_status: 'converted', currency: 'EUR', expires_at: '2099-01-01T00:00:00Z', ...extra });
const db = new FakeDb({
  storefront_carts: [
    cart(CART_PICKUP, { converted_order_id: ORD_PICKUP }),
    cart(CART_STRIPE, { stripe_session_id: 'cs_test_1' }),
    cart(CART_BANK, { converted_order_id: ORD_BANK }),
    cart(CART_NOLINK, {}),
    cart(CART_FOREIGN, { converted_order_id: ORD_FOREIGN }),
  ],
  storefront_cart_items: [],
  orders: [
    { id: ORD_PICKUP, tenant_id: T, order_number: 'S-1001', total: 18.5, currency: 'EUR', payment_method: 'pay_on_pickup', payment_status: 'pending', status: 'pending' },
    { id: ORD_STRIPE, tenant_id: T, order_number: 'S-1002', total: 22, currency: 'EUR', payment_method: 'bancontact', payment_status: 'paid', status: 'processing', stripe_checkout_session_id: 'cs_test_1' },
    { id: ORD_BANK, tenant_id: T, order_number: 'S-1003', total: 40, currency: 'EUR', payment_method: 'bank_transfer', payment_status: 'pending', status: 'pending' },
    { id: ORD_FOREIGN, tenant_id: OTHER, order_number: 'X-1', total: 1, currency: 'EUR', payment_method: 'pay_on_pickup', payment_status: 'pending', status: 'pending' },
    { id: ORD_KITCHEN, tenant_id: T, order_number: 'S-1004', status: 'processing', service_type: 'pickup', requested_time: '2026-11-02T18:30:00Z', table_label: null, created_at: '2026-11-02T18:00:00Z', updated_at: '2026-11-02T18:00:00Z' },
  ],
  tenants: [{ id: T, slug: 'qr2', name: 'QR Twee', iban: 'BE68 5390 0754 7034', bic: 'GKCCBEBB', currency: 'EUR', stripe_account_id: 'acct_y' }],
  table_requests: [
    { id: REQ_PENDING, tenant_id: T, status: 'pending', reason: null, table_label: 'Blauw 1', item_count: 1, total_cents: 450, created_at: '2026-11-02T19:00:00Z', decided_at: null, line_ids: null },
    { id: REQ_ACCEPTED, tenant_id: T, status: 'accepted', reason: null, table_label: 'Blauw 1', item_count: 2, total_cents: 900, created_at: '2026-11-02T19:01:00Z', decided_at: '2026-11-02T19:02:00Z', line_ids: [LINE_A, LINE_B] },
    { id: REQ_OTHER_TENANT, tenant_id: OTHER, status: 'accepted', reason: null, table_label: '9', item_count: 1, total_cents: 100, created_at: '2026-11-02T19:00:00Z', decided_at: null, line_ids: [] },
  ],
  check_lines: [
    { id: LINE_A, tenant_id: T, round_id: ROUND, station_id: ST_KITCHEN, state: 'sent' },
    { id: LINE_B, tenant_id: T, round_id: ROUND, station_id: ST_BAR, state: 'sent' },
  ],
  kitchen_tickets: [
    { id: 'k1', tenant_id: T, round_id: ROUND, station_id: ST_KITCHEN, status: 'preparing', status_at: '2026-11-02T19:05:00Z' },
    { id: 'k2', tenant_id: T, round_id: ROUND, station_id: ST_BAR, status: 'ready', status_at: '2026-11-02T19:04:00Z' },
    // Zelfde ronde, andere post zonder lijnen van deze aanvraag: telt niet mee.
    { id: 'k3', tenant_id: T, round_id: ROUND, station_id: u(53), status: 'new', status_at: '2026-11-02T19:03:00Z' },
    { id: 'k4', tenant_id: T, order_id: ORD_KITCHEN, station_id: null, status: 'done', status_at: '2026-11-02T18:40:00Z' },
  ],
  prep_stations: [{ id: ST_KITCHEN, tenant_id: T, name: 'Keuken' }, { id: ST_BAR, tenant_id: T, name: 'Bar' }],
  table_calls: [{ id: CALL, tenant_id: T, kind: 'bill', status: 'handled', created_at: '2026-11-02T19:10:00Z', handled_at: '2026-11-02T19:11:00Z' }],
  dining_tables: [{ id: TABLE, tenant_id: T, area_id: 'a1', label: 'Blauw 1', is_active: true, qr_token: TOKEN }],
  dining_areas: [{ id: 'a1', tenant_id: T, name: 'Binnen' }],
  dining_checks: [{ id: 'chk-1', tenant_id: T, table_id: TABLE, status: 'open', split_of: null, opened_at: '2026-11-02T18:00:00Z' }],
  check_online_payments: [
    { id: PAY_OLD, tenant_id: T, check_id: 'chk-1', status: 'pending', stripe_session_id: null },
    { id: PAY_OTHER_TABLE, tenant_id: T, check_id: 'chk-2', status: 'pending', stripe_session_id: null },
  ],
  fulfillment_settings: [{ tenant_id: T, qr_mode: 'view' }],
  tenant_domains: [], tenant_theme_settings: [],
});

let rpcAnswer: Record<string, { data: unknown; error: unknown }> = {};
const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
(db as any).rpc = (fn: string, args: Record<string, unknown>) => {
  rpcCalls.push({ fn, args });
  return Promise.resolve(rpcAnswer[fn] ?? { data: null, error: null });
};

(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
await import('../../supabase/functions/storefront-api/index.ts');
const handler = (globalThis as any).__serveHandler as (r: Request) => Promise<Response>;

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const call = async (action: string, params: Record<string, unknown>, ip = '1.1.1.1') => {
  const r = await handler(new Request('https://f/storefront-api', { method: 'POST', headers: { 'cf-connecting-ip': ip }, body: JSON.stringify({ action, tenant_id: T, params }) }));
  return { status: r.status, json: await r.json() };
};
const complete = (cart_id: string) => call('checkout_complete', { cart_id, payment_method_id: 'pay_on_pickup' });

// --- QR-IDEMP-1: checkout_complete --------------------------------------------------------------
Deno.test('checkout_complete herhaald: betalen bij afhalen → zelfde antwoord + duplicate', async () => {
  const r = await complete(CART_PICKUP);
  const d = r.json.data;
  assert(r.status === 200 && d.order_id === ORD_PICKUP && d.order_number === 'S-1001' && d.status === 'awaiting_payment'
    && d.payment_type === 'manual' && d.pay_on_pickup === true && d.total === 18.5 && d.currency === 'EUR' && d.duplicate === true, JSON.stringify(r.json));
});

Deno.test('checkout_complete herhaald: Stripe-order (via sessie) al betaald → completed, naar bevestiging', async () => {
  const d = (await complete(CART_STRIPE)).json.data;
  assert(d.success === true && d.order_id === ORD_STRIPE && d.status === 'completed' && d.payment_type === 'none' && d.duplicate === true, JSON.stringify(d));
});

Deno.test('checkout_complete herhaald: overschrijving → zelfde bankgegevens en QR als de eerste keer', async () => {
  const d = (await complete(CART_BANK)).json.data;
  assert(d.order_id === ORD_BANK && d.payment_type === 'qr' && d.status === 'awaiting_payment' && d.duplicate === true, JSON.stringify(d));
  assert(d.bank_details.iban === 'BE68 5390 0754 7034' && d.bank_details.reference === 'S-1003' && /EUR40\.00/.test(d.qr_data.payload), JSON.stringify(d));
});

Deno.test('checkout_complete herhaald zonder terug te vinden order → oude fout ORDER_ALREADY_PAID', async () => {
  const d = (await complete(CART_NOLINK)).json.data;
  assert(d.success === false && d.error.code === 'ORDER_ALREADY_PAID' && d.error.message === 'Deze bestelling is al afgerond', JSON.stringify(d));
});

Deno.test('checkout_complete: order van een andere tenant wordt nooit teruggegeven', async () => {
  const d = (await complete(CART_FOREIGN)).json.data;
  assert(d.success === false && d.error.code === 'ORDER_ALREADY_PAID' && !JSON.stringify(d).includes('X-1'), JSON.stringify(d));
});

// --- QR-IDEMP-1: online rekening ----------------------------------------------------------------
Deno.test('table_check_pay met release_payment_ids: enkel de oude poging op deze tafel wordt vrijgegeven', async () => {
  rpcCalls.length = 0;
  rpcAnswer = { table_check_pay_start: { data: null, error: { message: 'CHECK_PAY_BUSY', code: '55000' } } };
  await call('table_check_pay', {
    table_token: TOKEN, payment_id: PAY_NEW, kind: 'full', success_url: 'https://s/ok', cancel_url: 'https://s/no',
    release_payment_ids: [PAY_OLD, PAY_OTHER_TABLE, PAY_NEW, 'geen-uuid'],
  });
  const marks = rpcCalls.filter((c) => c.fn === 'table_check_pay_mark');
  assert(marks.length === 1 && marks[0].args.p_payment_id === PAY_OLD && marks[0].args.p_status === 'expired', JSON.stringify(rpcCalls));
  const startIdx = rpcCalls.findIndex((c) => c.fn === 'table_check_pay_start');
  assert(startIdx > rpcCalls.indexOf(marks[0]), 'eerst vrijgeven, dan starten');
});

Deno.test('table_check_pay zonder release_payment_ids: geen vrijgave (oud gedrag)', async () => {
  rpcCalls.length = 0;
  await call('table_check_pay', { table_token: TOKEN, payment_id: PAY_NEW, kind: 'full', success_url: 'https://s/ok', cancel_url: 'https://s/no' });
  assert(!rpcCalls.some((c) => c.fn === 'table_check_pay_mark'), JSON.stringify(rpcCalls));
});

// --- STATUS-1 -----------------------------------------------------------------------------------
Deno.test('table_request_status oud: zelfde velden + progress (geen line_ids naar buiten)', async () => {
  const d = (await call('table_request_status', { request_id: REQ_PENDING })).json.data;
  assert(JSON.stringify(Object.keys(d)) === JSON.stringify(['id', 'status', 'reason', 'table_label', 'item_count', 'total_cents', 'created_at', 'decided_at', 'progress']), JSON.stringify(d));
  assert(d.progress.stage === 'awaiting_confirmation', JSON.stringify(d));
});

Deno.test('table_request_status lijst: bevestigd → bonnen van de eigen posten; andere tenant ontbreekt', async () => {
  const d = (await call('table_request_status', { request_ids: [REQ_PENDING, REQ_ACCEPTED, REQ_OTHER_TENANT] })).json.data;
  assert(Array.isArray(d.requests) && d.requests.length === 2, JSON.stringify(d));
  const acc = d.requests.find((r: any) => r.id === REQ_ACCEPTED);
  // Keuken bezig + bar klaar = preparing; de bon 'new' van een andere post telt niet mee.
  assert(acc.progress.stage === 'preparing' && acc.progress.stations.length === 2, JSON.stringify(acc));
  assert(acc.progress.stations.some((s: any) => s.name === 'Bar' && s.status === 'ready') && acc.progress.updated_at === '2026-11-02T19:05:00Z', JSON.stringify(acc));
  assert(!JSON.stringify(d).includes(REQ_OTHER_TENANT), 'geen andere tenant');
});

Deno.test('table_request_status order + oproepen', async () => {
  const d = (await call('table_request_status', { order_id: ORD_KITCHEN, call_ids: [CALL] })).json.data;
  assert(d.order.order_number === 'S-1004' && d.order.status === 'received' && d.order.progress.stage === 'served', JSON.stringify(d));
  assert(d.calls.length === 1 && d.calls[0].status === 'handled', JSON.stringify(d));
  const none = (await call('table_request_status', { order_id: ORD_FOREIGN })).json.data;
  assert(none.order === null, JSON.stringify(none));
});

// --- OBER-ROEPEN-1 ------------------------------------------------------------------------------
Deno.test('table_call: ongeldige soort → TABLE_CALL_INVALID, geen databankaanroep', async () => {
  rpcCalls.length = 0;
  const d = (await call('table_call', { table_token: TOKEN, kind: 'beer' }, '2.2.2.2')).json.data;
  assert(d.success === false && d.error.code === 'TABLE_CALL_INVALID' && !rpcCalls.length, JSON.stringify(d));
});

Deno.test('table_call: met QR-token → table_call_place met de tafel uit het zaalplan', async () => {
  rpcCalls.length = 0;
  rpcAnswer = { table_call_place: { data: { call_id: CALL, kind: 'waiter', status: 'open', created_at: 'x', duplicate: false, retry_after_s: 120 }, error: null } };
  const r = await call('table_call', { table_token: TOKEN, kind: 'waiter', call_id: CALL }, '2.2.2.2');
  assert(r.json.success === true && r.json.data.call_id === CALL && r.json.data.retry_after_s === 120, JSON.stringify(r.json));
  const a = rpcCalls.find((c) => c.fn === 'table_call_place')?.args ?? {};
  assert(a.p_table_id === TABLE && a.p_table_label === 'Blauw 1' && a.p_kind === 'waiter' && a.p_call_id === CALL && a.p_tenant_id === T, JSON.stringify(a));
});

Deno.test('table_call: vrij tafelnummer in een zaak met zaalplan → geweigerd', async () => {
  rpcCalls.length = 0;
  const d = (await call('table_call', { table: '4', kind: 'bill' }, '2.2.2.2')).json.data;
  assert(d.success === false && !rpcCalls.some((c) => c.fn === 'table_call_place'), JSON.stringify(d));
});

Deno.test('table_call: rem in de databank → TOO_MANY_REQUESTS met uitleg', async () => {
  rpcAnswer = { table_call_place: { data: null, error: { message: 'TOO_MANY_REQUESTS', code: '55000' } } };
  const d = (await call('table_call', { table_token: TOKEN, kind: 'bill' }, '3.3.3.3')).json.data;
  assert(d.success === false && d.error.code === 'TOO_MANY_REQUESTS', JSON.stringify(d));
});

Deno.test('table_call: meer dan 10 per 10 min van hetzelfde IP → 429 RATE_LIMITED', async () => {
  rpcAnswer = { table_call_place: { data: { call_id: CALL, duplicate: true }, error: null } };
  let last = 0;
  for (let i = 0; i < 11; i++) last = (await call('table_call', { table_token: TOKEN, kind: 'waiter' }, '9.9.9.9')).status;
  assert(last === 429, String(last));
});

Deno.test('table_call: QR staat uit → TABLE_CALL_OFF', async () => {
  (db as any).tables.fulfillment_settings[0].qr_mode = 'off';
  try {
    const d = (await call('table_call', { table_token: TOKEN, kind: 'waiter' }, '4.4.4.4')).json.data;
    assert(d.success === false && d.error.code === 'TABLE_CALL_OFF', JSON.stringify(d));
  } finally {
    (db as any).tables.fulfillment_settings[0].qr_mode = 'view';
  }
});

// --- QR-MODULES-1 --------------------------------------------------------------------------------
const fs0 = () => (db as any).tables.fulfillment_settings[0];
Deno.test('QR-MODULES-1: zonder instelling staan beide oproepen aan (oud gedrag) en meldt de status ze', async () => {
  const d = (await call('table_request_status', { call_ids: [] })).json.data;
  assert(Array.isArray(d.calls) && d.calls.length === 0 && JSON.stringify(d.call_kinds) === '["waiter","bill"]', JSON.stringify(d));
});
Deno.test('QR-MODULES-1: oud statuspad (enkel request_id) krijgt geen call_kinds', async () => {
  const d = (await call('table_request_status', { request_id: REQ_PENDING })).json.data;
  assert(d.id === REQ_PENDING && !('call_kinds' in d), JSON.stringify(d));
});
Deno.test('QR-MODULES-1: "Ober roepen" uit → TABLE_CALL_KIND_OFF, geen databankaanroep; rekening vragen werkt nog', async () => {
  fs0().qr_call_waiter = false;
  try {
    rpcCalls.length = 0;
    const d = (await call('table_call', { table_token: TOKEN, kind: 'waiter' }, '5.5.5.5')).json.data;
    assert(d.success === false && d.error.code === 'TABLE_CALL_KIND_OFF' && /bediening roepen/.test(d.error.message) && !rpcCalls.length, JSON.stringify(d));
    rpcAnswer = { table_call_place: { data: { call_id: CALL, kind: 'bill', status: 'open', created_at: 'x', duplicate: false, retry_after_s: 120 }, error: null } };
    const ok = (await call('table_call', { table_token: TOKEN, kind: 'bill', call_id: CALL }, '5.5.5.5')).json;
    assert(ok.success === true && ok.data.call_id === CALL, JSON.stringify(ok));
    const st = (await call('table_request_status', { call_ids: [] })).json.data;
    assert(JSON.stringify(st.call_kinds) === '["bill"]', JSON.stringify(st));
  } finally { delete fs0().qr_call_waiter; }
});
Deno.test('QR-MODULES-1: "Rekening vragen" uit → TABLE_CALL_KIND_OFF', async () => {
  fs0().qr_call_bill = false;
  try {
    const d = (await call('table_call', { table_token: TOKEN, kind: 'bill' }, '6.6.6.6')).json.data;
    assert(d.success === false && d.error.code === 'TABLE_CALL_KIND_OFF' && /rekening vragen/.test(d.error.message), JSON.stringify(d));
    const st = (await call('table_request_status', { call_ids: [] })).json.data;
    assert(JSON.stringify(st.call_kinds) === '["waiter"]', JSON.stringify(st));
  } finally { delete fs0().qr_call_bill; }
});
Deno.test('QR-MODULES-1: QR-menu uit → call_kinds leeg', async () => {
  fs0().qr_mode = 'off';
  try {
    const st = (await call('table_request_status', { call_ids: [] })).json.data;
    assert(Array.isArray(st.call_kinds) && st.call_kinds.length === 0, JSON.stringify(st));
  } finally { fs0().qr_mode = 'view'; }
});

// --- HORECA-NU-2a ---------------------------------------------------------------------------------
Deno.test('HORECA-NU-2a: tafel in een dichte zone → ZONE_CLOSED voor oproepen, bestellen aan tafel en checkout_table', async () => {
  const area = (db as any).tables.dining_areas[0];
  area.is_open = false;
  fs0().qr_mode = 'order';
  try {
    rpcCalls.length = 0;
    const c = (await call('table_call', { table_token: TOKEN, kind: 'waiter' }, '7.7.7.7')).json.data;
    assert(c.success === false && c.error.code === 'ZONE_CLOSED' && c.error.message.startsWith('Binnen is momenteel gesloten'), JSON.stringify(c));
    const r = (await call('table_request_place', { request_id: u(81), cart_id: u(82), table_token: TOKEN }, '7.7.7.7')).json.data;
    assert(r.success === false && r.error.code === 'ZONE_CLOSED', JSON.stringify(r));
    const k = (await call('checkout_table', { cart_id: u(82), table_token: TOKEN }, '7.7.7.7')).json.data;
    assert(k.success === false && k.error.code === 'ZONE_CLOSED', JSON.stringify(k));
    assert(!rpcCalls.some((x) => x.fn === 'table_call_place' || x.fn === 'table_request_place'), JSON.stringify(rpcCalls));
    // resolve_table: additief veld is_open in area (de site toont de melding vooraf).
    const t = (await call('resolve_table', { token: TOKEN }, '7.7.7.7')).json.data;
    assert(t.label === 'Blauw 1' && t.area?.is_open === false && t.area?.name === 'Binnen', JSON.stringify(t));
  } finally { delete area.is_open; fs0().qr_mode = 'view'; }
  // Weer open (of geen kolom, oud gedrag): de oproep gaat gewoon door.
  rpcAnswer = { table_call_place: { data: { call_id: CALL, kind: 'waiter', status: 'open', created_at: 'x', duplicate: false, retry_after_s: 120 }, error: null } };
  const ok = (await call('table_call', { table_token: TOKEN, kind: 'waiter', call_id: CALL }, '8.8.8.8')).json;
  assert(ok.success === true, JSON.stringify(ok));
});

// --- HORECA-NU-1b ---------------------------------------------------------------------------------
// checkout_table gebeurde toen de zone nog open stond; daarna gaat het terras dicht. checkout_complete
// (en dus ook checkout_place_order / checkout_create_session, die erdoor lopen) zoekt de tafel van het
// mandje opnieuw op en weigert met ZONE_CLOSED.
Deno.test('HORECA-NU-1b: checkout_complete op een tafelmandje in een zone die intussen dicht is → ZONE_CLOSED', async () => {
  const CART_EAT = u(6);
  const t = (db as any).tables;
  t.storefront_carts.push({ id: CART_EAT, tenant_id: T, checkout_status: 'checkout', currency: 'EUR', expires_at: '2099-01-01T00:00:00Z',
    service_type: 'eat_in', table_label: 'Blauw 1', dining_table_id: TABLE, discount_codes: [], shipping_cost: 0, subtotal: 4.5 });
  t.storefront_cart_items.push({ id: 'li-eat', cart_id: CART_EAT, product_id: 'p-eat', variant_id: null, event_detail_id: null, quantity: 1, unit_price: 4.5,
    addons: [], addons_total: 0, products: { id: 'p-eat', name: 'Koffie', price: 4.5, track_inventory: false, stock: null, channels: ['table', 'menu'], sold_out_until: null } });
  t.products = [{ id: 'p-eat', tenant_id: T, name: 'Koffie', price: 4.5, track_inventory: false, channels: ['table', 'menu'], is_active: true }];
  const area = t.dining_areas[0];
  fs0().qr_mode = 'order';
  try {
    area.is_open = false;
    const d = (await complete(CART_EAT)).json.data;
    assert(d.success === false && d.error.code === 'ZONE_CLOSED' && d.error.message.startsWith('Binnen is momenteel gesloten'), JSON.stringify(d));
    // Zone van een tafel van een andere zaak telt niet: de lookup filtert op de winkel.
    t.dining_tables.push({ id: 'tb-other', tenant_id: OTHER, area_id: 'a-other', label: 'X', is_active: true, qr_token: 'c'.repeat(24) });
    t.dining_areas.push({ id: 'a-other', tenant_id: OTHER, name: 'Elders', is_open: false });
    area.is_open = true;
    t.storefront_carts.find((c: any) => c.id === CART_EAT).dining_table_id = 'tb-other';
    const o = (await complete(CART_EAT)).json.data;
    assert(!(o?.error?.code === 'ZONE_CLOSED'), `andere zaak: ${JSON.stringify(o)}`);
    // Zone weer open (of de kolom bestaat nog niet): geen ZONE_CLOSED.
    t.storefront_carts.find((c: any) => c.id === CART_EAT).dining_table_id = TABLE;
    delete area.is_open;
    const ok = (await complete(CART_EAT)).json.data;
    assert(!(ok?.error?.code === 'ZONE_CLOSED'), `open: ${JSON.stringify(ok)}`);
  } finally {
    delete area.is_open; fs0().qr_mode = 'view';
    t.storefront_carts.splice(t.storefront_carts.findIndex((c: any) => c.id === CART_EAT), 1);
    t.storefront_cart_items.length = 0;
    t.dining_tables.splice(1); t.dining_areas.splice(1);
  }
});

Deno.test('GET-stempel HORECA-STAAT-1', async () => {
  const r = await handler(new Request('https://f/storefront-api', { method: 'GET' }));
  assert((await r.json()).version === 'HORECA-STAAT-1' && r.headers.get('X-SellQo-Api-Rev') === 'horeca-staat-1', 'stempel');
});
