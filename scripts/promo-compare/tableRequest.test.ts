/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// QR-REKENING-1 — de ECHTE storefront-api-handler voor table_request_place / table_request_status
// tegen een nep-databank. De databankfunctie zelf (idempotentie, rem, rijlock) wordt live getest;
// hier: invoercontrole, foutcodes naar leesbare meldingen, en dat resolve_domain qr_flow geeft.
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/tableRequest.test.ts
import { FakeDb } from './fakeSupabase.ts';

const T = 'tenant-qr';
const REQ = '11111111-1111-4111-8111-111111111111';
const CART = '22222222-2222-4222-8222-222222222222';
const CART7 = '77777777-7777-4777-8777-777777777777';
const CART4 = '44444444-4444-4444-8444-444444444444';
const CART_GONE = '55555555-5555-4555-8555-555555555555';
const db = new FakeDb({
  dining_tables: [],
  dining_areas: [],
  table_requests: [{ id: REQ, tenant_id: T, status: 'rejected', reason: 'Keuken is dicht', table_label: '4', item_count: 2, total_cents: 900, created_at: '2026-10-28T10:00:00Z', decided_at: '2026-10-28T10:01:00Z' }],
  fulfillment_settings: [{ tenant_id: T, qr_mode: 'order', qr_flow: 'check' }],
  tenant_domains: [],
  tenants: [{ id: T, slug: 'qrtest', name: 'QR Test' }],
  tenant_theme_settings: [],
  // TAFEL-SESSIE-1: een mandje dat al aan tafel 7 hangt (checkout_table), en een van tafel 4.
  storefront_carts: [
    { id: CART7, tenant_id: T, service_type: 'eat_in', table_label: '7', dining_table_id: null },
    { id: CART4, tenant_id: T, service_type: 'eat_in', table_label: '4', dining_table_id: null },
    // Gebonden aan een zaalplan-tafel die niet meer bestaat, met de naam '4' (tafel opnieuw aangemaakt).
    { id: CART_GONE, tenant_id: T, service_type: 'eat_in', table_label: '4', dining_table_id: 'verwijderd' },
  ],
});

let rpcResult: { data: unknown; error: unknown } = { data: { request_id: REQ, status: 'pending', duplicate: false }, error: null };
const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
(db as any).rpc = (fn: string, args: Record<string, unknown>) => {
  rpcCalls.push({ fn, args });
  if (fn === 'table_request_place') return Promise.resolve(rpcResult);
  return Promise.resolve({ data: null, error: null });
};

(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
await import('../../supabase/functions/storefront-api/index.ts');
const handler = (globalThis as any).__serveHandler as (r: Request) => Promise<Response>;

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const call = async (action: string, params: Record<string, unknown>, tenant_id: string | null = T) => {
  const r = await handler(new Request('https://f/storefront-api', { method: 'POST', body: JSON.stringify({ action, tenant_id, params }) }));
  return { status: r.status, json: await r.json() };
};

Deno.test('ongeldige ids → nette fout, geen databankaanroep', async () => {
  rpcCalls.length = 0;
  const r = await call('table_request_place', { request_id: 'x', cart_id: CART, table: '4' });
  assert(r.json.data?.success === false && r.json.data.error.code === 'TABLE_REQUEST_INVALID', JSON.stringify(r.json));
  assert(rpcCalls.length === 0, 'rpc mocht niet aangeroepen worden');
});

Deno.test('geslaagd: geeft request_id terug en stuurt tafel en naam door', async () => {
  rpcCalls.length = 0;
  rpcResult = { data: { request_id: REQ, status: 'pending', duplicate: false }, error: null };
  const r = await call('table_request_place', { request_id: REQ, cart_id: CART, table: '4', guest_name: '  Jan  ', note: 'zonder ui' });
  assert(r.json.success === true && r.json.data.request_id === REQ, JSON.stringify(r.json));
  const a = rpcCalls[0]?.args ?? {};
  assert(rpcCalls[0]?.fn === 'table_request_place' && a.p_table_label === '4' && a.p_table_id === null && a.p_guest_name === 'Jan' && a.p_note === 'zonder ui', JSON.stringify(rpcCalls));
});

Deno.test('databankfout SOLD_OUT:<product> → leesbare melding', async () => {
  rpcResult = { data: null, error: { message: 'SOLD_OUT:Duvel', code: '22023' } };
  const r = await call('table_request_place', { request_id: REQ, cart_id: CART, table: '4' });
  assert(r.json.data?.error?.code === 'SOLD_OUT' && r.json.data.error.message === 'Duvel is op voor vandaag', JSON.stringify(r.json));
});

Deno.test('rem bij drukte → TOO_MANY_REQUESTS met uitleg', async () => {
  rpcResult = { data: null, error: { message: 'TOO_MANY_REQUESTS', code: '54000' } };
  const r = await call('table_request_place', { request_id: REQ, cart_id: CART, table: '4' });
  assert(r.json.data?.error?.code === 'TOO_MANY_REQUESTS', JSON.stringify(r.json));
});

Deno.test('status: geweigerd met reden; onbekend → NOT_FOUND', async () => {
  const ok = await call('table_request_status', { request_id: REQ });
  assert(ok.json.data?.status === 'rejected' && ok.json.data.reason === 'Keuken is dicht', JSON.stringify(ok.json));
  const nf = await call('table_request_status', { request_id: '33333333-3333-4333-8333-333333333333' });
  assert(nf.json.data?.error?.code === 'NOT_FOUND', JSON.stringify(nf.json));
});

Deno.test('resolve_domain geeft qr_flow', async () => {
  const r = await call('resolve_domain', { hostname: 'qrtest.sellqo.shop' }, null);
  assert(r.json.data?.qr_flow === 'check' && r.json.data.qr_mode === 'order', JSON.stringify(r.json));
});

Deno.test('TAFEL-SESSIE-1: mandje van tafel 7 doorgeven voor tafel 4 → CART_OTHER_TABLE, geen databankaanroep', async () => {
  rpcCalls.length = 0;
  const r = await call('table_request_place', { request_id: REQ, cart_id: CART7, table: '4' });
  assert(r.json.data?.success === false && r.json.data.error.code === 'CART_OTHER_TABLE', JSON.stringify(r.json));
  assert(rpcCalls.length === 0, 'rpc mocht niet aangeroepen worden');
});

Deno.test('TAFEL-SESSIE-1: mandje van tafel 4 aan tafel 4 → gewoon doorgegeven', async () => {
  rpcCalls.length = 0;
  rpcResult = { data: { request_id: REQ, status: 'pending', duplicate: false }, error: null };
  const r = await call('table_request_place', { request_id: REQ, cart_id: CART4, table: '4' });
  assert(r.json.success === true && r.json.data.request_id === REQ && rpcCalls.length === 1, JSON.stringify(r.json));
});

Deno.test('TAFEL-SESSIE-1: checkout_table met een mandje van een andere tafel → CART_OTHER_TABLE, mandje niet aangepast', async () => {
  const before = db.writes.length;
  const r = await call('checkout_table', { cart_id: CART7, table: '4' });
  assert(r.json.data?.success === false && r.json.data.error.code === 'CART_OTHER_TABLE', JSON.stringify(r.json));
  assert(!db.writes.slice(before).some((w: any) => w.table === 'storefront_carts'), 'mandje mocht niet bijgewerkt worden');
});

Deno.test('TAFEL-SESSIE-1: gebonden tafel bestaat niet meer, zelfde naam → geen CART_OTHER_TABLE', async () => {
  rpcCalls.length = 0;
  rpcResult = { data: { request_id: REQ, status: 'pending', duplicate: false }, error: null };
  const r = await call('table_request_place', { request_id: REQ, cart_id: CART_GONE, table: '4' });
  assert(r.json.success === true && rpcCalls.length === 1, JSON.stringify(r.json));
});
