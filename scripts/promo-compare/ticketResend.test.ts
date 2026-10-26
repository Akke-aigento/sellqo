/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// EVENT-409-1 — test van de ECHTE send-ticket-confirmation-handler tegen een nep-databank.
// "Tickets opnieuw mailen" vanuit de admin (gebruikerstoken) weigert een geannuleerde of
// volledig terugbetaalde bestelling met 409 ORDER_CLOSED. Het betaalpad (service-role) en
// een gedeeltelijke terugbetaling lopen door zoals voorheen. Er wordt niets gemaild: de
// testorders hebben geen tickets of muntenkaart, dus de functie stopt bij "skipped".
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/ticketResend.test.ts
import { FakeDb } from './fakeSupabase.ts';

const T = 'tenant-ev';
const SERVICE = 'service-key';
const order = (id: string, status: string, payment_status: string) => ({
  id, order_number: `#${id}`, customer_email: 'k@example.com', customer_name: 'K', locale: 'nl', tenant_id: T,
  shipping_address: null, payment_status, status,
});
const db: any = new FakeDb({
  orders: [
    order('o-cancel', 'cancelled', 'paid'),
    order('o-refund', 'delivered', 'refunded'),
    order('o-part', 'delivered', 'partially_refunded'),
    order('o-paid', 'delivered', 'paid'),
  ].map((o, i) => ({ ...o, id: `00000000-0000-0000-0000-00000000000${i + 1}` })),
  ticket_instances: [],
  token_wallets: [],
  user_roles: [{ user_id: 'u1', role: 'tenant_admin', tenant_id: T }],
});
db.auth = { getUser: (tok: string) => Promise.resolve(tok === 'user-token' ? { data: { user: { id: 'u1', email: 'a@b.c' } }, error: null } : { data: { user: null }, error: { message: 'bad' } }) };
const ID = { cancel: '00000000-0000-0000-0000-000000000001', refund: '00000000-0000-0000-0000-000000000002', part: '00000000-0000-0000-0000-000000000003', paid: '00000000-0000-0000-0000-000000000004' };

(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SERVICE);
Deno.env.set('RESEND_API_KEY', 'test');
await import('../../supabase/functions/send-ticket-confirmation/index.ts');
const handler = (globalThis as any).__serveHandler as (r: Request) => Promise<Response>;

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const call = async (token: string, order_id: string) => {
  const r = await handler(new Request('https://f/send-ticket-confirmation', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ order_id }),
  }));
  return { status: r.status, body: await r.json() };
};

Deno.test('GET geeft de versiestempel EVENT-409-1', async () => {
  const r = await handler(new Request('https://f/send-ticket-confirmation'));
  const j = await r.json();
  assert(r.status === 200 && j.version === 'EVENT-409-1', JSON.stringify(j));
});

Deno.test('admin: geannuleerd of volledig terugbetaald → 409 ORDER_CLOSED', async () => {
  for (const id of [ID.cancel, ID.refund]) {
    const r = await call('user-token', id);
    assert(r.status === 409 && r.body.success === false && r.body.error === 'ORDER_CLOSED', JSON.stringify(r));
  }
});

Deno.test('admin: gedeeltelijk terugbetaald of betaald → voorbij de poort (hier: skipped, geen tickets)', async () => {
  for (const id of [ID.part, ID.paid]) {
    const r = await call('user-token', id);
    assert(r.status === 200 && r.body.skipped === true, JSON.stringify(r));
  }
});

Deno.test('betaalpad (service-role) is niet geraakt, ook niet bij een geannuleerde order', async () => {
  const r = await call(SERVICE, ID.cancel);
  assert(r.status === 200 && r.body.skipped === true, JSON.stringify(r));
});
