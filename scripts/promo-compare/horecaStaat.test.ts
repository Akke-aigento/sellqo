/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// HORECA-STAAT-1 — de ECHTE storefront-api-handler tegen een nep-databank: één bron voor "kan hier nu besteld
// worden?" en die bron in elk pad dat een bestelling maakt.
//   - get_config.ordering_state (additief) en resolve_table.ordering_state (met de zone);
//   - vandaag dicht: online én aan tafel geweigerd (CLOSED_TODAY) bij toevoegen, checkout_table,
//     table_request_place en checkout_complete;
//   - keuken gepauzeerd: online geweigerd (ORDERING_PAUSED); aan tafel enkel keukengerechten (KITCHEN_PAUSED),
//     dranken (bar) gaan door; get_products/get_product markeren keukengerechten (kitchen_paused_until);
//   - online bestellen uit: gemeld in ordering_state, tafel blijft open;
//   - zone dicht: resolve_table meldt zone_closed; buiten de uren met blokkering: OUTSIDE_HOURS;
//   - een eigen frontend zonder uren of pauze: niets verandert.
// Op de code van vóór HORECA-STAAT-1 falen de weiger- en ordering_state-tests (zie role-audit).
//
// Run (vanuit de repo-root, netwerkloos):
//   DENO_NO_PACKAGE_JSON=1 deno test --allow-env --no-lock --node-modules-dir=none --minimum-dependency-age=0 \
//     --import-map=scripts/promo-compare/import_map.resolve.json scripts/promo-compare/horecaStaat.test.ts
import { FakeDb } from './fakeSupabase.ts';

const T = 'tenant-wissel';
const CUSTOM = 'tenant-eigen-frontend';
const u = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const CART = u(1), CART_TABLE = u(2), REQ = u(3);
const BURGER = u(11), COLA = u(12), CROQUE = u(13);
const CAT_EAT = u(21), CAT_DRINK = u(22);
const ST_BAR = u(31), ST_KITCHEN = u(32);
const TOKEN = 'cccccccccccccccccccccccc';
const TABLE_ID = u(41), AREA_TERRAS = u(42);
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const SOON = () => new Date(Date.now() + 15 * 60_000).toISOString();

const product = (id: string, name: string, category_id: string, extra: Record<string, unknown> = {}) => ({
  id, tenant_id: T, name, slug: name.toLowerCase(), price: 4, is_active: true, track_inventory: false, stock: 0,
  category_id, channels: ['online', 'table', 'menu', 'pos'], sold_out_until: null, images: [], hide_from_storefront: false, product_type: 'physical', ...extra,
});
const db = new FakeDb({
  tenants: [{ id: T, slug: 'wissel', name: 'Café De Wissel', currency: 'EUR' }, { id: CUSTOM, slug: 'eigen', name: 'Eigen', currency: 'EUR' }],
  tenant_theme_settings: [
    { tenant_id: T, shop_live: true, shop_ordering: true, use_custom_frontend: false },
    { tenant_id: CUSTOM, shop_live: false, shop_ordering: false, use_custom_frontend: true },
  ],
  fulfillment_settings: [{ tenant_id: T, qr_mode: 'order', qr_flow: 'check', slots_enabled: false, slot_minutes: 15, prep_minutes: 0, days_ahead: 1,
    timezone: 'Europe/Brussels', hours: {}, paused_until: null, qr_block_outside_hours: false, online_block_outside_hours: false, pay_on_pickup: true }],
  business_hours: [{ tenant_id: T, timezone: 'Europe/Brussels', week: {}, closures: [] }],
  shipping_methods: [{ id: u(51), tenant_id: T, name: 'Afhalen aan de toog', fulfillment_type: 'pickup', is_active: true },
    { id: u(52), tenant_id: CUSTOM, name: 'Verzending', fulfillment_type: 'shipping', is_active: true }],
  prep_stations: [{ id: ST_BAR, tenant_id: T, kind: 'bar', name: 'Bar', is_active: true, is_default: true },
    { id: ST_KITCHEN, tenant_id: T, kind: 'kitchen', name: 'Keuken', is_active: true, is_default: false }],
  prep_station_routes: [{ id: u(61), tenant_id: T, station_id: ST_KITCHEN, category_id: CAT_EAT, product_id: null }],
  products: [product(BURGER, 'Burger', CAT_EAT), product(COLA, 'Cola', CAT_DRINK), product(CROQUE, 'Croque', CAT_EAT),
    { ...product(u(14), 'Hoodie', CAT_DRINK), tenant_id: CUSTOM }],
  categories: [], product_categories: [], product_variants: [], translations: [], tenant_domains: [], storefront_config: [], storefront_pages: [],
  legal_pages: [], homepage_sections: [], product_addon_groups: [], product_reviews: [], bundle_items: [], event_details: [], orders: [],
  storefront_carts: [], storefront_cart_items: [],
  dining_tables: [{ id: TABLE_ID, tenant_id: T, label: 'T1', area_id: AREA_TERRAS, qr_token: TOKEN, is_active: true }],
  dining_areas: [{ id: AREA_TERRAS, tenant_id: T, name: 'Terras', is_active: true, is_open: true }],
});
const rpcCalls: string[] = [];
(db as any).rpc = (fn: string) => { rpcCalls.push(fn); return Promise.resolve({ data: fn === 'table_request_place' ? { request_id: REQ, status: 'pending' } : null, error: null }); };

(globalThis as any).__fakeDb = db;
Deno.env.set('SUPABASE_URL', 'https://x.supabase.co');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
await import('../../supabase/functions/storefront-api/index.ts');
const handler = (globalThis as any).__serveHandler as (r: Request) => Promise<Response>;

const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const call = async (action: string, params: Record<string, unknown> = {}, tenant_id: string = T) => {
  const r = await handler(new Request('https://f/storefront-api', { method: 'POST', body: JSON.stringify({ action, tenant_id, params }) }));
  return { status: r.status, json: await r.json() };
};
const fs = () => db.tables.fulfillment_settings[0];
const bh = () => db.tables.business_hours[0];
/** Foutcode uit een antwoord: { data: { success:false, error:{code} } } of een geworpen JSON-fout (toevoegen). */
const code = (j: any): string | null => {
  if (j?.data?.success === false) return j.data.error?.code ?? null;
  if (j?.success === false && typeof j.error === 'string') { try { return JSON.parse(j.error).code ?? j.error; } catch { return j.error; } }
  return null;
};
function resetCarts() {
  db.tables.storefront_carts = [
    { id: CART, tenant_id: T, checkout_status: 'shopping', currency: 'EUR', expires_at: '2999-01-01T00:00:00Z', customer_email: 'a@b.be', service_type: 'pickup', shipping_method_id: u(51), subtotal: 4, shipping_cost: 0 },
    { id: CART_TABLE, tenant_id: T, checkout_status: 'shopping', currency: 'EUR', expires_at: '2999-01-01T00:00:00Z', service_type: 'eat_in', table_label: 'T1', dining_table_id: TABLE_ID, subtotal: 4, shipping_cost: 0 },
  ];
  db.tables.storefront_cart_items = [];
}
function putInCart(cartId: string, productId: string) {
  const p = db.tables.products.find((x: any) => x.id === productId);
  db.tables.storefront_cart_items.push({ id: u(900 + db.tables.storefront_cart_items.length), cart_id: cartId, product_id: productId, variant_id: null, quantity: 1, unit_price: 4, addons: null, addons_total: 0, products: p, product_variants: null });
}
async function withState(over: { closures?: unknown[]; paused?: string | null; week?: unknown; qrBlock?: boolean; ordering?: boolean }, fn: () => Promise<void>) {
  const saved = { closures: bh().closures, week: bh().week, paused: fs().paused_until, qrb: fs().qr_block_outside_hours, ord: db.tables.tenant_theme_settings[0].shop_ordering };
  if (over.closures) bh().closures = over.closures;
  if (over.week) bh().week = over.week;
  if (over.paused !== undefined) fs().paused_until = over.paused;
  if (over.qrBlock !== undefined) fs().qr_block_outside_hours = over.qrBlock;
  if (over.ordering !== undefined) db.tables.tenant_theme_settings[0].shop_ordering = over.ordering;
  resetCarts();
  try { await fn(); } finally {
    bh().closures = saved.closures; bh().week = saved.week; fs().paused_until = saved.paused; fs().qr_block_outside_hours = saved.qrb;
    db.tables.tenant_theme_settings[0].shop_ordering = saved.ord;
  }
}
const CLOSED_TODAY = [{ from: TODAY, to: TODAY, reason: 'Personeel ziek' }];

Deno.test('normaal: ordering_state open in beide contexten, toevoegen en tafelaanvraag lukken', async () => {
  await withState({}, async () => {
    const st = (await call('get_config')).json.data.ordering_state;
    assert(st?.online?.open === true && st.table.open === true && st.closed_today === null, JSON.stringify(st));
    assert(code((await call('cart_add_item', { cart_id: CART, product_id: BURGER })).json) === null, 'online toevoegen');
    putInCart(CART_TABLE, BURGER);
    const r = await call('table_request_place', { request_id: REQ, cart_id: CART_TABLE, table_token: TOKEN });
    assert(code(r.json) === null && r.json.data?.request_id === REQ, JSON.stringify(r.json));
  });
});

Deno.test('vandaag dicht: get_config meldt het, online en aan tafel geweigerd met CLOSED_TODAY', async () => {
  await withState({ closures: CLOSED_TODAY }, async () => {
    const st = (await call('get_config')).json.data.ordering_state;
    assert(st.online.reason === 'closed_today' && /Vandaag gesloten · Personeel ziek · Morgen weer open/.test(st.online.message), JSON.stringify(st.online));
    assert(st.table.reason === 'closed_today' && st.closed_today?.reason === 'Personeel ziek', JSON.stringify(st));
    assert(code((await call('cart_add_item', { cart_id: CART, product_id: COLA })).json) === 'CLOSED_TODAY', 'online toevoegen');
    assert(code((await call('cart_add_item', { cart_id: CART_TABLE, product_id: COLA, table: true })).json) === 'CLOSED_TODAY', 'tafel toevoegen');
    assert(code((await call('checkout_table', { cart_id: CART_TABLE, table_token: TOKEN })).json) === 'CLOSED_TODAY', 'checkout_table');
    putInCart(CART_TABLE, COLA);
    rpcCalls.length = 0;
    assert(code((await call('table_request_place', { request_id: REQ, cart_id: CART_TABLE, table_token: TOKEN })).json) === 'CLOSED_TODAY', 'tafelaanvraag');
    assert(!rpcCalls.includes('table_request_place'), 'geen aanvraag in de databank');
    putInCart(CART, COLA);
    assert(code((await call('checkout_complete', { cart_id: CART, payment_method_id: 'pay_on_pickup' })).json) === 'CLOSED_TODAY', 'online afrekenen');
    assert(code((await call('checkout_complete', { cart_id: CART_TABLE, payment_method_id: 'pay_on_pickup' })).json) === 'CLOSED_TODAY', 'tafel afrekenen');
  });
});

Deno.test('vandaag dicht: oproepen (rekening vragen) blijft kunnen — wie al zit, kan afrekenen', async () => {
  await withState({ closures: CLOSED_TODAY }, async () => {
    const r = await call('table_call', { kind: 'bill', table_token: TOKEN });
    assert(code(r.json) !== 'CLOSED_TODAY', JSON.stringify(r.json));
  });
});

Deno.test('keuken gepauzeerd: online ORDERING_PAUSED; aan tafel burger KITCHEN_PAUSED, cola gaat door', async () => {
  await withState({ paused: SOON() }, async () => {
    const st = (await call('get_config')).json.data.ordering_state;
    assert(st.online.reason === 'paused' && /De keuken neemt even geen bestellingen aan\. Weer open om \d\d:\d\d\./.test(st.online.message), JSON.stringify(st.online));
    assert(st.table.open === true && st.table.reason === 'paused' && st.table.scope === 'kitchen', JSON.stringify(st.table));
    assert(code((await call('cart_add_item', { cart_id: CART, product_id: COLA })).json) === 'ORDERING_PAUSED', 'online: alles stil');
    const b = (await call('cart_add_item', { cart_id: CART_TABLE, product_id: BURGER, table: true })).json;
    assert(code(b) === 'KITCHEN_PAUSED' && /Burger: keuken even gesloten tot \d\d:\d\d/.test(b.error), JSON.stringify(b));
    assert(code((await call('cart_add_item', { cart_id: CART_TABLE, product_id: COLA, table: true })).json) === null, 'cola aan tafel mag');
    assert(code((await call('checkout_table', { cart_id: CART_TABLE, table_token: TOKEN })).json) === null, 'checkout_table mag (posten bekend)');
    putInCart(CART_TABLE, COLA);
    assert(code((await call('table_request_place', { request_id: REQ, cart_id: CART_TABLE, table_token: TOKEN })).json) === null, 'enkel drank: door');
    putInCart(CART_TABLE, CROQUE);
    const r = (await call('table_request_place', { request_id: REQ, cart_id: CART_TABLE, table_token: TOKEN })).json;
    assert(code(r) === 'KITCHEN_PAUSED' && /Croque/.test(r.data.error.message), JSON.stringify(r));
    assert(code((await call('checkout_complete', { cart_id: CART_TABLE, payment_method_id: 'pay_on_pickup' })).json) === 'KITCHEN_PAUSED', 'tafel afrekenen met croque');
    putInCart(CART, COLA);
    assert(code((await call('checkout_complete', { cart_id: CART, payment_method_id: 'pay_on_pickup' })).json) === 'ORDERING_PAUSED', 'online afrekenen');
  });
});

Deno.test('keuken gepauzeerd: get_products en get_product markeren enkel keukengerechten', async () => {
  await withState({ paused: SOON() }, async () => {
    const resp = (await call('get_products', { per_page: 50 })).json;
    const list = resp.data?.products ?? [];
    if (!list.length) console.log(JSON.stringify(resp).slice(0, 400));
    const byName = Object.fromEntries(list.map((p: any) => [p.name, p]));
    assert(byName.Burger?.kitchen_paused_until && byName.Croque?.kitchen_paused_until, JSON.stringify(list.map((p: any) => [p.name, p.kitchen_paused_until])));
    assert(!('kitchen_paused_until' in byName.Cola), 'cola: geen sleutel');
    const one = (await call('get_product', { slug: 'burger' })).json.data;
    assert(one?.kitchen_paused_until, `get_product burger: ${JSON.stringify(one).slice(0, 200)}`);
    const cola = (await call('get_product', { slug: 'cola' })).json.data;
    assert(cola && !('kitchen_paused_until' in cola), 'get_product cola: geen sleutel');
  });
  const calm = (await call('get_products', { per_page: 50 })).json.data.products;
  assert(calm.every((p: any) => !('kitchen_paused_until' in p)), 'zonder pauze: byte-gelijk, geen sleutel');
});

Deno.test('keuken gepauzeerd zonder posten: aan tafel ligt alles stil (scope all)', async () => {
  const saved = db.tables.prep_stations;
  db.tables.prep_stations = [];
  try {
    await withState({ paused: SOON() }, async () => {
      const st = (await call('get_config')).json.data.ordering_state;
      assert(st.table.open === false && st.table.scope === 'all', JSON.stringify(st.table));
      assert(code((await call('cart_add_item', { cart_id: CART_TABLE, product_id: COLA, table: true })).json) === 'KITCHEN_PAUSED', 'ook drank');
      assert(code((await call('checkout_table', { cart_id: CART_TABLE, table_token: TOKEN })).json) === 'KITCHEN_PAUSED', 'checkout_table');
    });
  } finally { db.tables.prep_stations = saved; }
});

Deno.test('verlopen pauze: niets meer geweigerd', async () => {
  await withState({ paused: new Date(Date.now() - 60_000).toISOString() }, async () => {
    assert((await call('get_config')).json.data.ordering_state.online.reason === null, 'online open');
    assert(code((await call('cart_add_item', { cart_id: CART_TABLE, product_id: BURGER, table: true })).json) === null, 'burger mag weer');
  });
});

Deno.test('online bestellen uit: ordering_state ordering_off, tafel blijft open (de site verbergt de knoppen)', async () => {
  await withState({ ordering: false }, async () => {
    const st = (await call('get_config')).json.data.ordering_state;
    assert(st.online.reason === 'ordering_off' && st.table.open === true, JSON.stringify(st));
  });
});

Deno.test('zone dicht: resolve_table meldt zone_closed; checkout_table ZONE_CLOSED (zoals voorheen)', async () => {
  db.tables.dining_areas[0].is_open = false;
  try {
    await withState({}, async () => {
      const r = (await call('resolve_table', { token: TOKEN })).json.data;
      assert(r.label === 'T1' && r.area.is_open === false && r.ordering_state?.table?.reason === 'zone_closed', JSON.stringify(r));
      assert(code((await call('checkout_table', { cart_id: CART_TABLE, table_token: TOKEN })).json) === 'ZONE_CLOSED', 'checkout_table');
    });
  } finally { db.tables.dining_areas[0].is_open = true; }
});

Deno.test('buiten de uren met blokkering: tafel OUTSIDE_HOURS ook bij toevoegen; zonder blokkering open', async () => {
  const nowLocal = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Brussels', weekday: 'short' }).format(new Date());
  const other = String((['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(nowLocal) + 3) % 7);
  await withState({ week: { [other]: [['10:00', '10:01']] }, qrBlock: true }, async () => {
    assert((await call('get_config')).json.data.ordering_state.table.reason === 'outside_hours', 'state');
    assert(code((await call('cart_add_item', { cart_id: CART_TABLE, product_id: COLA, table: true })).json) === 'OUTSIDE_HOURS', 'toevoegen aan tafel');
    assert(code((await call('cart_add_item', { cart_id: CART, product_id: COLA })).json) === null, 'online zonder online-blokkering: open');
  });
  await withState({ week: { [other]: [['10:00', '10:01']] }, qrBlock: false }, async () => {
    assert(code((await call('cart_add_item', { cart_id: CART_TABLE, product_id: COLA, table: true })).json) === null, 'zonder schakelaar: open');
  });
});

Deno.test('eigen frontend zonder uren of pauze: niets verandert, enkel een extra sleutel', async () => {
  db.tables.storefront_carts.push({ id: u(99), tenant_id: CUSTOM, checkout_status: 'shopping', currency: 'EUR', expires_at: '2999-01-01T00:00:00Z' });
  const st = (await call('get_config', {}, CUSTOM)).json.data;
  assert(st.ordering_state?.online?.open === true, `shop_live/shop_ordering tellen niet voor eigen frontends: ${JSON.stringify(st.ordering_state)}`);
  const keys = Object.keys(st);
  assert(keys[keys.length - 1] === 'ordering_state' && keys.length === 10, JSON.stringify(keys));
  assert(code((await call('cart_add_item', { cart_id: u(99), product_id: u(14) }, CUSTOM)).json) === null, 'toevoegen lukt');
});
