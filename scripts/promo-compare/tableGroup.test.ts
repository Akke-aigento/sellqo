/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// TAFEL-SAMEN-1 — de ECHTE storefront-api-handlers voor de tafelgroep (table_group_*), het gedeelde mandje
// (cart_add_item / cart_update_item / cart_remove_item met table_group_id) en de rekening per groep
// (table_check_get / table_check_pay met group_id), tegen een nep-databank. De databankfuncties zelf
// (aansluiten, einde, slot, on conflict, welke lijnen) zijn getest op PG16 (samen-test/tests.sql, conc*.sh).
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/tableGroup.test.ts
import { FakeDb } from './fakeSupabase.ts';

const T = 'tenant-samen';
const TOKEN = 'abcdefabcdefabcdefabcdef';
const TOKEN9 = 'fedcbafedcbafedcbafedcba';
const TABLE = '88888888-8888-4888-8888-888888888888';
const TABLE9 = '99999999-9999-4999-8999-999999999999';
const G = '11111111-1111-4111-8111-111111111111';
const G9 = '19191919-1919-4919-8919-191919191919';
const CART = '22222222-2222-4222-8222-222222222222';
const CART_NEW = '23232323-2323-4323-8323-232323232323';
const PROD = '33333333-3333-4333-8333-333333333333';
const ITEM = '44444444-4444-4444-8444-444444444444';
const REQ = '55555555-5555-4555-8555-555555555555';
const PAY = '66666666-6666-4666-8666-666666666666';
const L_MINE = '77777777-7777-4777-8777-777777777777';
const L_MINE2 = '78787878-7878-4878-8878-787878787878';
const L_OLD = '79797979-7979-4979-8979-797979797979';

const db = new FakeDb({
  dining_tables: [
    { id: TABLE, tenant_id: T, area_id: 'a1', label: '8', is_active: true, qr_token: TOKEN },
    { id: TABLE9, tenant_id: T, area_id: 'a1', label: '9', is_active: true, qr_token: TOKEN9 },
  ],
  dining_areas: [{ id: 'a1', tenant_id: T, name: 'Zaal', is_open: true }],
  table_guest_groups: [{ id: G, tenant_id: T, dining_table_id: TABLE }, { id: G9, tenant_id: T, dining_table_id: TABLE9 }],
  table_requests: [{ id: REQ, tenant_id: T, group_id: G, status: 'pending', reason: null, table_label: '8', item_count: 2, total_cents: 560, created_at: '2026-11-06T11:00:00Z', decided_at: null, line_ids: null }],
  storefront_carts: [{ id: CART, tenant_id: T, checkout_status: 'shopping', expires_at: '2099-01-01T00:00:00Z' }],
  storefront_cart_items: [],
  products: [{ id: PROD, tenant_id: T, name: 'Pils', price: 2.8, is_active: true, track_inventory: false, stock: 0, category_id: null, channels: null, sold_out_until: null }],
  fulfillment_settings: [{ tenant_id: T, qr_mode: 'order', qr_flow: 'check' }],
  tenants: [{ id: T, slug: 'samen', name: 'Samen', stripe_account_id: 'acct_x', currency: 'EUR' }],
  tenant_domains: [], tenant_theme_settings: [], check_online_payments: [],
});

type Rpc = { data: unknown; error: unknown };
const rpcResults: Record<string, Rpc> = {};
const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
(db as any).rpc = (fn: string, args: Record<string, unknown>) => {
  rpcCalls.push({ fn, args });
  return Promise.resolve(rpcResults[fn] ?? { data: null, error: null });
};
const reset = () => { rpcCalls.length = 0; db.writes.length = 0; for (const k of Object.keys(rpcResults)) delete rpcResults[k]; };

(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
await import('../../supabase/functions/storefront-api/index.ts');
const handler = (globalThis as any).__serveHandler as (r: Request) => Promise<Response>;

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const call = async (action: string, params: Record<string, unknown>) => {
  const r = await handler(new Request('https://f/storefront-api', { method: 'POST', body: JSON.stringify({ action, tenant_id: T, params }) }));
  return { status: r.status, json: await r.json() };
};
const view = (mixed: boolean) => ({
  ended: false, since: '2026-11-06T10:00:00Z', group: { id: G, started_at: '2026-11-06T10:00:00Z', version: 4 },
  check: { id: 'c1', total_cents: 1010, credit_cents: 0, remaining_cents: 1010, held_cents: 0, pending_kinds: [], mixed, hidden_open: mixed ? 1 : 0,
    lines: [{ id: L_MINE, open_qty: 2, held_qty: 0 }, { id: L_MINE2, open_qty: 1, held_qty: 1 }] },
  settings: { online_pay: true, tip: true, split: true, share: !mixed },
});

Deno.test('join: enkel met een zaalplan-tafel; cookie- en linkgroep gaan door', async () => {
  reset();
  const free = await call('table_group_join', { table: '8' });
  assert(free.json.data?.success === false && !rpcCalls.some((c) => c.fn === 'table_group_join'), JSON.stringify(free.json));
  rpcResults.table_group_join = { data: { group_id: G, joined: 'member', cart_id: CART, shared: true, version: 3 }, error: null };
  const r = await call('table_group_join', { table_token: TOKEN, group_id: G, join: 'geen-uuid' });
  const a = rpcCalls.find((c) => c.fn === 'table_group_join')?.args ?? {};
  assert(r.json.data?.group_id === G && r.json.data.table_label === '8', JSON.stringify(r.json));
  assert(a.p_table_id === TABLE && a.p_group_id === G && a.p_link === null && a.p_fresh_scan === false, JSON.stringify(a));
  // B1: enkel een verse scan (fresh: true) mag aansluiten of een groep maken.
  reset();
  await call('table_group_join', { table_token: TOKEN, fresh: true });
  assert(rpcCalls.find((c) => c.fn === 'table_group_join')?.args.p_fresh_scan === true, 'fresh doorgegeven');
  reset();
  await call('table_group_join', { table_token: TOKEN, fresh: 'true' });
  assert(rpcCalls.find((c) => c.fn === 'table_group_join')?.args.p_fresh_scan === false, 'enkel boolean true telt');
});

Deno.test('state: zonder geldige groep → ended, geen databankaanroep', async () => {
  reset();
  const r = await call('table_group_state', { table_token: TOKEN, group_id: 'x' });
  assert(r.json.data?.ended === true && rpcCalls.length === 0, JSON.stringify(r.json));
});

Deno.test('cart_add_item met table_group_id → table_group_cart_put (add), niet het lees-dan-schrijf-pad', async () => {
  reset();
  const r = await call('cart_add_item', { cart_id: CART, product_id: PROD, quantity: 2, table: true, table_group_id: G });
  const put = rpcCalls.find((c) => c.fn === 'table_group_cart_put');
  assert(put && put.args.p_op === 'add' && put.args.p_cart_id === CART && put.args.p_group_id === G, JSON.stringify(rpcCalls));
  const item = put!.args.p_item as Record<string, unknown>;
  assert(item.product_id === PROD && item.quantity === 2 && item.unit_price === 2.8 && item.max_qty === null, JSON.stringify(item));
  assert(!db.writes.some((w: any) => w.table === 'storefront_cart_items'), 'geen rechtstreekse schrijfactie op cartregels: ' + JSON.stringify(db.writes));
  assert(r.json.success === true, JSON.stringify(r.json));
});

Deno.test('cart_add_item zonder table_group_id: bestaand pad (insert), geen groepsfunctie (custom frontends)', async () => {
  reset();
  const r = await call('cart_add_item', { cart_id: CART, product_id: PROD, quantity: 1 });
  assert(r.json.success === true, JSON.stringify(r.json));
  assert(!rpcCalls.some((c) => c.fn.startsWith('table_group')), JSON.stringify(rpcCalls));
  assert(db.writes.some((w: any) => w.table === 'storefront_cart_items' && w.insert), JSON.stringify(db.writes));
});

Deno.test('geroteerd mandje → CART_ROTATED met het nieuwe mandje', async () => {
  reset();
  rpcResults.table_group_cart_put = { data: null, error: { message: `CART_ROTATED:${CART_NEW}`, code: '40001' } };
  const r = await call('cart_add_item', { cart_id: CART, product_id: PROD, quantity: 1, table: true, table_group_id: G });
  assert(r.json.data?.success === false && r.json.data.error.code === 'CART_ROTATED' && r.json.data.error.cart_id === CART_NEW, JSON.stringify(r.json));
});

Deno.test('voorraad na optellen (databank) → zelfde fout als het gewone pad', async () => {
  reset();
  rpcResults.table_group_cart_put = { data: null, error: { message: 'INSUFFICIENT_STOCK:3', code: '22023' } };
  const r = await call('cart_add_item', { cart_id: CART, product_id: PROD, quantity: 1, table: true, table_group_id: G });
  assert(r.status >= 400 && /Slechts 3 beschikbaar/.test(String(r.json.error)), JSON.stringify(r.json));
});

Deno.test('cart_update_item / cart_remove_item met groep: regel al weg → ITEM_GONE of het mandje zoals het is', async () => {
  reset();
  const u = await call('cart_update_item', { cart_id: CART, item_id: ITEM, quantity: 2, table_group_id: G });
  assert(u.json.data?.error?.code === 'ITEM_GONE', JSON.stringify(u.json));
  const d = await call('cart_remove_item', { cart_id: CART, item_id: ITEM, table_group_id: G });
  assert(d.json.success === true && d.json.data?.id === CART, JSON.stringify(d.json));
  assert(!rpcCalls.some((c) => c.fn === 'table_group_cart_put'), JSON.stringify(rpcCalls));
});

Deno.test('table_group_place: afgelopen groep → GROUP_ENDED; gedeeld → mandje van de groep', async () => {
  reset();
  rpcResults.table_group_state = { data: { ended: true }, error: null };
  const e = await call('table_group_place', { table_token: TOKEN, group_id: G, request_id: REQ });
  assert(e.json.data?.error?.code === 'GROUP_ENDED' && !rpcCalls.some((c) => c.fn === 'table_group_request_place'), JSON.stringify(e.json));
  reset();
  rpcResults.table_group_state = { data: { ended: false, shared: true, cart_id: CART }, error: null };
  rpcResults.table_group_request_place = { data: { request_id: REQ, status: 'pending', duplicate: false, cart_id: CART_NEW }, error: null };
  const r = await call('table_group_place', { table_token: TOKEN, group_id: G, request_id: REQ, cart_id: 'geen-uuid', guest_name: ' Akke ' });
  const a = rpcCalls.find((c) => c.fn === 'table_group_request_place')?.args ?? {};
  assert(r.json.data?.cart_id === CART_NEW && a.p_cart_id === CART && a.p_group_id === G && a.p_guest_name === 'Akke' && a.p_table_label === '8', JSON.stringify({ r: r.json, a }));
  // K7: het mandje dat de gsm toonde gaat mee; de databank zegt JUST_SENT als het intussen doorgegeven werd.
  reset();
  rpcResults.table_group_state = { data: { ended: false, shared: true, cart_id: CART_NEW }, error: null };
  rpcResults.table_group_request_place = { data: null, error: { message: 'JUST_SENT', code: '55000' } };
  const js = await call('table_group_place', { table_token: TOKEN, group_id: G, request_id: REQ, cart_id: CART });
  const aj = rpcCalls.find((c) => c.fn === 'table_group_request_place')?.args ?? {};
  assert(aj.p_cart_id === CART && js.json.data?.error?.code === 'JUST_SENT' && /tafelgenoot/.test(js.json.data.error.message), JSON.stringify(js.json));
  reset();
  rpcResults.table_group_state = { data: { ended: false, shared: true, cart_id: CART }, error: null };
  rpcResults.table_group_request_place = { data: null, error: { message: 'SOLD_OUT:Wit bier', code: '22023' } };
  const so = await call('table_group_place', { table_token: TOKEN, group_id: G, request_id: REQ });
  assert(so.json.data?.error?.message === 'Wit bier is op voor vandaag', JSON.stringify(so.json));
});

Deno.test('overview: rondes van de groep (server) + rekening van de groep', async () => {
  reset();
  rpcResults.table_group_view = { data: view(true), error: null };
  const r = await call('table_group_overview', { table_token: TOKEN, group_id: G });
  assert(r.json.data?.ended === false && r.json.data.requests.length === 1 && r.json.data.requests[0].id === REQ && r.json.data.check.mixed === true, JSON.stringify(r.json));
  // Een groep van een andere tafel telt niet.
  reset();
  rpcResults.table_group_view = { data: view(false), error: null };
  const other = await call('table_group_overview', { table_token: TOKEN, group_id: G9 });
  assert(other.json.data?.ended === true && !rpcCalls.some((c) => c.fn === 'table_group_view'), JSON.stringify(other.json));
});

Deno.test('table_check_get met group_id → groepsweergave; andere tafel → GROUP_ENDED', async () => {
  reset();
  rpcResults.table_group_view = { data: view(false), error: null };
  const r = await call('table_check_get', { table_token: TOKEN, group_id: G });
  assert(r.json.data?.table_label === '8' && r.json.data.check.total_cents === 1010 && !rpcCalls.some((c) => c.fn === 'table_check_view'), JSON.stringify(r.json));
  const o = await call('table_check_get', { table_token: TOKEN9, group_id: G });
  assert(o.json.data?.error?.code === 'GROUP_ENDED', JSON.stringify(o.json));
});

Deno.test('table_check_get zonder groep (vangnet): na dagreset; oudere open lijnen → online betalen uit', async () => {
  reset();
  rpcResults.table_check_view_since = { data: { since: 'x', check: { id: 'c1', hidden_open: 2, lines: [] }, settings: { online_pay: true, tip: true, split: true } }, error: null };
  const r = await call('table_check_get', { table_token: TOKEN });
  assert(r.json.data?.settings?.online_pay === false && !rpcCalls.some((c) => c.fn === 'table_check_view'), JSON.stringify(r.json));
  reset();
  rpcResults.table_check_view_since = { data: null, error: { message: 'function public.table_check_view_since does not exist', code: 'PGRST202' } };
  rpcResults.table_check_view = { data: { check: { id: 'c1', total_cents: 2400, lines: [] }, settings: { online_pay: true } }, error: null };
  const old = await call('table_check_get', { table_token: TOKEN });
  assert(old.json.data?.check?.total_cents === 2400, 'zonder migratie: het oude antwoord ' + JSON.stringify(old.json));
});

const pay = (extra: Record<string, unknown>) => call('table_check_pay', { table_token: TOKEN, payment_id: PAY, success_url: 'https://s/ok', cancel_url: 'https://s/no', ...extra });
Deno.test('betalen per groep: één databanktransactie (table_group_pay_start), oude pogingen eerst vrijgegeven (B5/B6)', async () => {
  reset();
  (db as any).tables.dining_checks = [{ id: 'chk8', tenant_id: T, table_id: TABLE, status: 'open', split_of: null, opened_at: '2026-11-06T10:00:00Z' }];
  (db as any).tables.check_online_payments = [{ id: '67676767-6767-4767-8767-676767676767', tenant_id: T, status: 'expired', check_id: 'chk8' }];
  rpcResults.table_group_pay_start = { data: null, error: { message: 'CHECK_PAY_NO_SHARE', code: '55000' } };
  const r = await pay({ kind: 'share', share_n: 2, share_k: 1, group_id: G, release_payment_ids: ['67676767-6767-4767-8767-676767676767'] });
  assert(r.json.data?.error?.code === 'CHECK_PAY_NO_SHARE' && /vorige gasten/.test(r.json.data.error.message), JSON.stringify(r.json));
  const names = rpcCalls.map((c) => c.fn);
  assert(!names.includes('table_check_pay_start') && !names.includes('table_group_view'), 'geen losse weergave of pay_start: ' + JSON.stringify(names));
  const a = rpcCalls.find((c) => c.fn === 'table_group_pay_start')?.args ?? {};
  assert(a.p_group_id === G && a.p_kind === 'share' && a.p_share_n === 2 && a.p_payment_id === PAY, JSON.stringify(a));
  // De vrijgave (QR-IDEMP-1) gebeurt vóór de groepsberekening: de leesactie op de oude poging komt eerst.
  const firstPayRpc = rpcCalls.findIndex((c) => c.fn === 'table_group_pay_start');
  assert(firstPayRpc >= 0, 'pay_start aangeroepen');
  (db as any).tables.dining_checks = [];
  (db as any).tables.check_online_payments = [];
});

Deno.test('betalen per groep: groep van een andere tafel → GROUP_ENDED, geen databankbetaling', async () => {
  reset();
  const r = await pay({ kind: 'full', group_id: G9 });
  assert(r.json.data?.error?.code === 'GROUP_ENDED' && !rpcCalls.some((c) => c.fn.endsWith('pay_start')), JSON.stringify(r.json));
});

Deno.test('betalen per groep: gemengd zonder splitsen → leesbare melding (B7); te veel lijnen → K1', async () => {
  reset();
  rpcResults.table_group_pay_start = { data: null, error: { message: 'CHECK_PAY_MIXED', code: '55000' } };
  const m = await pay({ kind: 'full', group_id: G });
  assert(m.json.data?.error?.code === 'CHECK_PAY_MIXED' && /personeel/.test(m.json.data.error.message), JSON.stringify(m.json));
  rpcResults.table_group_pay_start = { data: null, error: { message: 'CHECK_PAY_TOO_MANY', code: '54000' } };
  const k = await pay({ kind: 'full', group_id: G });
  assert(k.json.data?.error?.code === 'CHECK_PAY_TOO_MANY' && /in delen/.test(k.json.data.error.message), JSON.stringify(k.json));
});

Deno.test('betalen zonder group_id: bestaand pad; alles/delen geweigerd als er lijnen van vóór de dagreset openstaan (K3)', async () => {
  reset();
  rpcResults.table_check_pay_start = { data: null, error: { message: 'CHECK_PAY_BUSY', code: '55000' } };
  await pay({ kind: 'full' });
  assert(!rpcCalls.some((c) => c.fn.startsWith('table_group')) && rpcCalls.find((c) => c.fn === 'table_check_pay_start')?.args.p_kind === 'full', JSON.stringify(rpcCalls));
  reset();
  rpcResults.table_check_view_since = { data: { check: { hidden_open: 2 } }, error: null };
  const old = await pay({ kind: 'full' });
  assert(old.json.data?.error?.code === 'CHECK_PAY_OLD_LINES' && !rpcCalls.some((c) => c.fn === 'table_check_pay_start'), JSON.stringify(old.json));
  reset();
  rpcResults.table_check_view_since = { data: { check: { hidden_open: 2 } }, error: null };
  rpcResults.table_check_pay_start = { data: null, error: { message: 'CHECK_PAY_BUSY', code: '55000' } };
  await pay({ kind: 'lines', lines: [{ line_id: L_MINE, qty: 1 }] });
  assert(rpcCalls.find((c) => c.fn === 'table_check_pay_start')?.args.p_kind === 'lines', 'mijn items blijft kunnen: ' + JSON.stringify(rpcCalls));
});

Deno.test('GET-stempel FIXES-0711', async () => {
  const r = await handler(new Request('https://f/storefront-api', { method: 'GET' }));
  assert((await r.json()).version === 'FIXES-0711' && r.headers.get('X-SellQo-Api-Rev') === 'fixes-0711', 'stempel');
});
