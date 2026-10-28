/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// EVENT-409-1 — test van de ECHTE storefront-api-handler tegen een thenable nep-databank.
// cart_add_item op een volzet event of tickettype geeft HTTP 409 met exact dezelfde body
// als vroeger (toen 500). Alle andere fouten blijven 500.
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/event409.test.ts
import { FakeDb } from './fakeSupabase.ts';

const T = 'tenant-ev';
const db = new FakeDb({
  storefront_carts: [{ id: 'cart-ev', tenant_id: T, session_id: 's', currency: 'EUR', discount_codes: [], expires_at: '2999-01-01T00:00:00Z' }],
  storefront_cart_items: [],
  products: [{ id: 'tk', tenant_id: T, name: 'Crawl', price: 15, track_inventory: false, stock: 0, is_active: true, category_id: null, channels: null, sold_out_until: null, product_type: 'ticket' }],
  event_details: [
    { id: 'ev-open', product_id: 'tk', tenant_id: T, status: 'scheduled', early_bird_price: null, early_bird_deadline: null, early_bird_quantity: null, venue_id: null },
    { id: 'ev-weg', product_id: 'tk', tenant_id: T, status: 'cancelled', early_bird_price: null, early_bird_deadline: null, early_bird_quantity: null, venue_id: null },
  ],
  event_ticket_types: [
    { id: 'tt1', event_detail_id: 'ev-open', product_id: 'tk', tenant_id: T, is_active: true, sales_start: null, sales_end: null, sub_capacity: 10, early_bird_price: null },
  ],
});

// Capaciteit per test instelbaar: wat check_event_capacity teruggeeft voor tickettype resp. event.
let typeCap: Record<string, unknown> = { ok: true };
let eventCap: Record<string, unknown> = { ok: true };
(db as any).rpc = (fn: string, args: Record<string, unknown>) => {
  if (fn === 'get_event_signup_count') return Promise.resolve({ data: 0, error: null });
  if (fn === 'check_event_capacity') return Promise.resolve({ data: args.p_product_id ? typeCap : eventCap, error: null });
  return Promise.resolve({ data: null, error: null });
};

(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
await import('../../supabase/functions/storefront-api/index.ts');
const handler = (globalThis as any).__serveHandler as (r: Request) => Promise<Response>;

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const post = async (params: Record<string, unknown>) => {
  const r = await handler(new Request('https://f/storefront-api', {
    method: 'POST', body: JSON.stringify({ action: 'cart_add_item', tenant_id: T, params }),
  }));
  return { status: r.status, text: await r.text() };
};
const add = (event_detail_id = 'ev-open') => post({ cart_id: 'cart-ev', product_id: 'tk', quantity: 2, event_detail_id });
// De body zoals de vangst hem altijd al opbouwde: { success:false, error: <JSON-string> }.
const body = (err: Record<string, unknown>) => JSON.stringify({ success: false, error: JSON.stringify(err) });

Deno.test('GET geeft de versiestempel (REKENING-ONLINE-1)', async () => {
  const r = await handler(new Request('https://f/storefront-api'));
  const j = await r.json();
  assert(r.status === 200 && j.version === 'REKENING-ONLINE-1', JSON.stringify(j));
});

Deno.test('tickettype volzet → 409, body byte-gelijk', async () => {
  typeCap = { ok: false, reason: 'ticket_type_full', type_spots_left: 1 }; eventCap = { ok: true };
  const r = await add();
  assert(r.status === 409, `status ${r.status}`);
  assert(r.text === body({ code: 'TICKET_TYPE_FULL', message: 'Dit tickettype is uitverkocht', spots_left: 1 }), r.text);
});

Deno.test('event volzet → 409, body byte-gelijk', async () => {
  typeCap = { ok: true }; eventCap = { ok: false, reason: 'event_full', event_spots_left: 0 };
  const r = await add();
  assert(r.status === 409, `status ${r.status}`);
  assert(r.text === body({ code: 'EVENT_FULL', message: 'Dit evenement is volzet', spots_left: 0 }), r.text);
});

Deno.test('andere weigering (datum niet meer beschikbaar) blijft 500', async () => {
  typeCap = { ok: true }; eventCap = { ok: true };
  const r = await add('ev-weg');
  assert(r.status === 500, `status ${r.status}`);
  assert(r.text === body({ code: 'EVENT_DATE_UNAVAILABLE', message: 'Deze datum is niet meer beschikbaar' }), r.text);
});

Deno.test('onbekende cart blijft 500 met dezelfde body', async () => {
  const r = await post({ cart_id: 'bestaat-niet', product_id: 'tk', quantity: 1, event_detail_id: 'ev-open' });
  assert(r.status === 500, `status ${r.status}`);
  assert(r.text === JSON.stringify({ success: false, error: 'Cart not found' }), r.text);
});
