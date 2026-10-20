// Rooktest storefront-api (R10 in sellqo-engineering-rules): roept de ECHTE functies
// get_products, get_product_filters en computeCartTotals aan tegen een thenable
// nep-databank. Vangt fouten die deno check en unit tests missen, zoals `await` op een
// querybuilder (CATALOG-FILTERS-1, 13-10-2026).
//
// Run (vanuit de repo-root, met netwerk voor de echte imports):
//   cp supabase/functions/storefront-api/index.ts supabase/functions/storefront-api/__smoke.ts
//   echo 'export { getProducts, getProductFilters, computeCartTotals, cartAddItem, getFulfillmentSlots, validateCartFulfillment, payOnPickupMethod, checkoutTable, fulfillmentAvailability, foodInfo, ticketFeeFor, orderOverageFeeCents, resolveEventPrice, earlyBirdForType, seatPublicStatus, validateDiscountCode, appliedCodesOnly, resolveDomain, getSeo, getSitemapData, isSoldOutToday, channelAllows, cartAvailabilityError, cartRestore, cartGet, getCartForCheckout, checkoutComplete };' >> supabase/functions/storefront-api/__smoke.ts
//   deno run --allow-read --allow-env --allow-net --no-lock --import-map=scripts/promo-compare/import_map.smoke.json scripts/promo-compare/smoke.ts
//   rm supabase/functions/storefront-api/__smoke.ts
import { FakeDb } from './fakeSupabase.ts';

const S = await import('../../supabase/functions/storefront-api/__smoke.ts');

const T = 'tenant-1';
const cat = { id: 'c1', name: 'Tees', slug: 'tees', hide_from_storefront: false };
const product = (id: string, name: string, price: number, extra: Record<string, unknown> = {}) => ({
  id, tenant_id: T, name, slug: id, description: null, price, compare_at_price: null, images: [], featured_image: null,
  is_active: true, hide_from_storefront: false, track_inventory: true, stock: 5, sku: null, category_id: 'c1', tags: ['zomer'],
  is_featured: false, product_type: 'physical', bundle_pricing_model: null, bundle_discount_value: null,
  created_at: '2026-10-01T00:00:00Z', categories: cat, channels: ['online', 'table', 'menu', 'pos'], sold_out_until: null, ...extra,
});
const variant = (pid: string, attrs: Record<string, string>, stock = 3) => ({
  id: `${pid}-${JSON.stringify(attrs)}`, product_id: pid, price: null, stock, track_inventory: true, is_active: true, attribute_values: attrs,
});

const db = new FakeDb({
  products: [product('p1', 'Tee A', 20), product('p2', 'Tee B', 30, { stock: 0 }), product('p3', 'Hoodie', 50)],
  product_variants: [variant('p1', { Maat: 'S' }), variant('p1', { Maat: 'M' }, 0), variant('p3', { Maat: 'L' })],
  categories: [{ ...cat, tenant_id: T }],
  product_categories: [],
  volume_discounts: [], bogo_promotions: [], product_bundles: [], automatic_discounts: [], discount_stacking_rules: [],
  discount_codes: [], customer_groups: [], tenants: [{ id: T, tax_percentage: 21 }],
  // FOOD-1
  shipping_methods: [
    { id: 'sm-pickup', tenant_id: T, name: 'Afhalen', price: 0, is_active: true, fulfillment_type: 'pickup', postal_codes: null, min_order_amount: null },
    { id: 'sm-del', tenant_id: T, name: 'Levering', price: 2.5, is_active: true, fulfillment_type: 'local_delivery', postal_codes: ['3000'], min_order_amount: 15 },
  ],
  product_addon_groups: [
    { id: 'g1', tenant_id: T, name: 'Toppings', min_select: 0, max_select: 2, category_ids: ['c1'], product_ids: [], sort_order: 0, is_active: true },
    { id: 'g2', tenant_id: T, name: 'Saus', min_select: 1, max_select: 1, category_ids: [], product_ids: ['p3'], sort_order: 1, is_active: true },
  ],
  product_addon_options: [
    { id: 'o1', group_id: 'g1', tenant_id: T, name: 'Kaas', price: 1.5, sort_order: 0, is_active: true },
    { id: 'o2', group_id: 'g1', tenant_id: T, name: 'Ham', price: 2, sort_order: 1, is_active: true },
    { id: 'o3', group_id: 'g2', tenant_id: T, name: 'Tomaat', price: 0, sort_order: 0, is_active: true },
  ],
  storefront_carts: [{ id: 'cart1', tenant_id: T, session_id: 's', currency: 'EUR', discount_codes: [], expires_at: '2999-01-01T00:00:00Z' }],
  storefront_cart_items: [],
  fulfillment_settings: [{ tenant_id: T, slots_enabled: true, slot_minutes: 15, prep_minutes: 0, days_ahead: 1, max_orders_per_slot: null, timezone: 'Europe/Brussels',
    hours: { pickup: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [['00:00', '23:45']]])) } }],
  orders: [],
});

let failures = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); console.log(`ok   ${name}`); } catch (e) { failures++; console.error(`FAIL ${name}: ${e instanceof Error ? e.message : e}`); }
}
const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };

await check('get_products default', async () => {
  const r = await S.getProducts(db, T, {});
  assert(r.products.length === 3, `3 producten verwacht, kreeg ${r.products.length}`);
});
await check('get_products category_slug + search', async () => {
  const r = await S.getProducts(db, T, { category_slug: 'tees', search: 'tee' });
  assert(r.products.length === 2, `2 verwacht, kreeg ${r.products.length}`);
});
await check('get_products options + available_only', async () => {
  const r = await S.getProducts(db, T, { options: { Maat: ['M'] }, available_only: true });
  assert(r.products.length === 0, 'M is uitverkocht');
  const r2 = await S.getProducts(db, T, { options: { maat: ['s', 'l'] } });
  assert(r2.pagination.total_count === 2, `2 verwacht, kreeg ${r2.pagination.total_count}`);
});
await check('get_products best_selling', async () => {
  const r = await S.getProducts(db, T, { sort_by: 'best_selling', per_page: 2 });
  assert(r.products.length === 2 && r.pagination.total_count === 3, 'paginering na sortering');
});
await check('get_products ids (SHOP-API-3)', async () => {
  const r = await S.getProducts(db, T, { ids: ['p3', 'p1'] });
  assert(r.products.map((x: { id: string }) => x.id).join(',') === 'p3,p1', `volgorde ${r.products.map((x: { id: string }) => x.id)}`);
  const r2 = await S.getProducts(db, T, { ids: [] });
  assert(r2.products.length === 0, 'lege ids = niets');
});
await check('get_product_filters', async () => {
  const r = await S.getProductFilters(db, T, { category_slug: 'tees' });
  assert(r.total === 3 && r.available === 2, `total/available ${r.total}/${r.available}`);
  assert(r.options[0]?.name === 'Maat', 'optie Maat');
});
await check('computeCartTotals', async () => {
  const r = await S.computeCartTotals(db, T, { discount_codes: [] }, [{ product_id: 'p1', quantity: 2, unit_price: 20, line_total: 40 }]);
  assert(r.subtotal === 40 && r.total === 40, `subtotal/total ${r.subtotal}/${r.total}`);
});

await check('cart_add_item met extra\'s (FOOD-1)', async () => {
  db.writes.length = 0;
  await S.cartAddItem(db, T, { cart_id: 'cart1', product_id: 'p1', addons: ['o2', 'o1'] });
  const ins = db.writes.find((w) => w.table === 'storefront_cart_items' && w.insert)?.insert as Record<string, unknown>;
  assert(ins && ins.unit_price === 23.5 && ins.addons_total === 3.5 && ins.addon_key === 'o1,o2', `insert ${JSON.stringify(ins)}`);
});
await check('cart_add_item zonder extra\'s blijft zoals voorheen', async () => {
  db.writes.length = 0;
  await S.cartAddItem(db, T, { cart_id: 'cart1', product_id: 'p1' });
  const ins = db.writes.find((w) => w.table === 'storefront_cart_items' && w.insert)?.insert as Record<string, unknown>;
  assert(ins && ins.unit_price === 20 && !('addons' in ins) && !('addon_key' in ins), `insert ${JSON.stringify(ins)}`);
});
await check('cart_add_item verplichte groep', async () => {
  let code = '';
  try { await S.cartAddItem(db, T, { cart_id: 'cart1', product_id: 'p3' }); } catch (e) { code = JSON.parse((e as Error).message).code; }
  assert(code === 'ADDON_MIN', `code ${code}`);
});
await check('get_fulfillment_slots', async () => {
  const r = await S.getFulfillmentSlots(db, T, { type: 'pickup' });
  assert(r.enabled && r.slots.length > 0, `slots ${r.slots.length}`);
  const none = await S.getFulfillmentSlots(db, T, { type: 'local_delivery' });
  assert(none.enabled && none.slots.length === 0, 'geen leveruren = geen sloten');
});
await check('validateCartFulfillment', async () => {
  const e1 = await S.validateCartFulfillment(db, T, { shipping_method_id: 'sm-pickup', subtotal: 20 });
  assert(e1?.code === 'SLOT_REQUIRED', `pickup zonder slot: ${e1?.code}`);
  const e2 = await S.validateCartFulfillment(db, T, { shipping_method_id: 'sm-del', subtotal: 20, shipping_address: { postal_code: '2000' } });
  assert(e2?.code === 'DELIVERY_ZONE', `zone: ${e2?.code}`);
  const e3 = await S.validateCartFulfillment(db, T, { shipping_method_id: 'sm-del', subtotal: 10, shipping_address: { postal_code: '3000' } });
  assert(e3?.code === 'MIN_ORDER', `minimum: ${e3?.code}`);
  assert(await S.validateCartFulfillment(db, T, { shipping_method_id: null, subtotal: 1 }) === null, 'gewone verzending ongemoeid');
});

await check('payOnPickupMethod (FOOD-2)', async () => {
  assert(await S.payOnPickupMethod(db, T, 'pickup') === null, 'uit zonder instelling');
  db.tables.fulfillment_settings[0].pay_on_pickup = true;
  const m = await S.payOnPickupMethod(db, T, 'pickup');
  assert(m?.method === 'pay_on_pickup' && m.name === 'Betalen bij afhalen', `pickup: ${JSON.stringify(m)}`);
  assert((await S.payOnPickupMethod(db, T, 'local_delivery'))?.name === 'Betalen bij levering', 'levering');
  assert(await S.payOnPickupMethod(db, T, null) === null, 'gewone verzending: nooit');
  db.tables.fulfillment_settings[0].pay_on_pickup = false;
});

await check('bestellen aan tafel (HORECA-1)', async () => {
  const off = await S.checkoutTable(db, T, { cart_id: 'cart1', table: '4' });
  assert(off?.error?.code === 'TABLE_ORDERING_OFF', `standaard uit: ${JSON.stringify(off)}`);
  const bad = await S.checkoutTable(db, T, { cart_id: 'cart1', table: '4; drop' });
  assert(bad?.error?.code === 'VALIDATION_ERROR', 'ongeldig tafelnummer');
  db.tables.fulfillment_settings[0].qr_mode = 'order';
  const m = await S.payOnPickupMethod(db, T, 'eat_in');
  assert(m?.name === 'Betalen aan de toog', `toog: ${JSON.stringify(m)}`);
  db.tables.fulfillment_settings[0].qr_pay_counter = false;
  assert(await S.payOnPickupMethod(db, T, 'eat_in') === null, 'toog uit');
  db.tables.fulfillment_settings[0].qr_mode = 'view';
  db.tables.fulfillment_settings[0].qr_pay_counter = true;
});

await check('leverzone gaat voor minimumbedrag (DEMO-1)', async () => {
  const m = { fulfillment_type: 'local_delivery', min_order_amount: 15, postal_codes: ['3000'] };
  assert(S.fulfillmentAvailability(m, { postal_code: '2000', subtotal: 5 }).unavailable_reason === 'delivery_zone', 'buiten zone en te weinig: zone eerst');
  assert(S.fulfillmentAvailability(m, { postal_code: '3000', subtotal: 5 }).unavailable_reason === 'min_order', 'in zone, te weinig');
  assert(S.fulfillmentAvailability(m, { postal_code: '3000', subtotal: 20 }).available === true, 'in zone, genoeg');
});

await check('pauze en sluitingsdag (PAUSE-1)', async () => {
  const fs = db.tables.fulfillment_settings[0];
  fs.slots_enabled = false;
  assert(await S.validateCartFulfillment(db, T, { shipping_method_id: 'sm-pickup', subtotal: 20 }) === null, 'zonder pauze: zo snel mogelijk kan');
  fs.paused_until = new Date(Date.now() + 30 * 60000).toISOString();
  const p = await S.validateCartFulfillment(db, T, { shipping_method_id: 'sm-pickup', subtotal: 20 });
  assert(p?.code === 'ORDERING_PAUSED', `gepauzeerd: ${p?.code}`);
  const r = await S.getFulfillmentSlots(db, T, { type: 'pickup' });
  assert(r.blocked?.reason === 'paused', `slots melden pauze: ${JSON.stringify(r.blocked)}`);
  fs.paused_until = null;
  fs.slots_enabled = true;
  const r2 = await S.getFulfillmentSlots(db, T, { type: 'pickup' });
  assert(!('blocked' in r2), 'geen pauze = geen extra sleutel');
});

await check('allergenen alleen als ingevuld (ALLERGEN-1)', async () => {
  assert(JSON.stringify(S.foodInfo({ allergens: [], dietary: [] })) === '{}', 'leeg = geen sleutels (respons ongewijzigd)');
  assert(JSON.stringify(S.foodInfo({})) === '{}', 'ontbrekend = geen sleutels');
  const r = S.foodInfo({ allergens: ['gluten', 'milk'], dietary: ['vegetarian'] });
  assert(r.allergens?.join() === 'gluten,milk' && r.dietary?.join() === 'vegetarian', JSON.stringify(r));
});

await check('kost per ticket via platform_ticket_fee_for, alleen betaalde tickets (FLEX-1 / PLANS-2)', async () => {
  // PLANS-2: het tarief komt uit één SQL-functie (plan van het events-spoor, anders de
  // Flex-fee van de add-on; intern/demo/vrijgesteld = 0).
  const calls: string[] = [];
  const stub = (fee: number | null, error: unknown = null) => ({
    rpc: async (fn: string, args: Record<string, unknown>) => { calls.push(`${fn}:${args.p_tenant_id}`); return { data: fee, error }; },
  });
  const items = [
    { event_detail_id: 'e1', unit_price: 20, quantity: 2 },
    { event_detail_id: 'e1', unit_price: 0, quantity: 3 },
    { event_detail_id: null, unit_price: 10, quantity: 1 },
  ];
  const flex = await S.ticketFeeFor(stub(0.69), T, items);
  assert(flex.tickets === 2 && flex.feeCents === 138, `flex: ${JSON.stringify(flex)}`);
  assert(calls[0] === `platform_ticket_fee_for:${T}`, `rpc-aanroep: ${calls[0]}`);
  const vast = await S.ticketFeeFor(stub(0.29), T, items);
  assert(vast.feeCents === 58, `vast: ${JSON.stringify(vast)}`);
  const exempt = await S.ticketFeeFor(stub(0), T, items);
  assert(exempt.feeCents === 0, 'vrijgesteld: geen kost');
  const none = await S.ticketFeeFor(stub(0.69), T, [{ event_detail_id: null, unit_price: 10, quantity: 1 }]);
  assert(none.feeCents === 0 && none.tickets === 0, 'geen tickets: geen kost');
  let threw = false;
  try { await S.ticketFeeFor(stub(null, { message: 'boom' }), T, items); } catch { threw = true; }
  assert(threw, 'mislukte lookup: geen verkoop zonder fee');
});

await check('2% boven het gratis orderlimiet (LIMITS-1)', async () => {
  const calls: string[] = [];
  const stub = (data: unknown, error: unknown = null) => ({
    rpc: (fn: string, args: Record<string, unknown>) => { calls.push(`${fn}:${args.p_tenant_id}`); return Promise.resolve({ data, error }); },
  });
  const items = [{ event_detail_id: null, unit_price: 25, quantity: 2 }];
  assert(await S.orderOverageFeeCents(stub(2), T, items, 5000) === 100, '2% van €50 = 100 cent');
  assert(calls[0] === `platform_order_overage_rate:${T}`, `rpc-aanroep: ${calls[0]}`);
  assert(await S.orderOverageFeeCents(stub(0), T, items, 5000) === 0, 'binnen het limiet: geen fee');
  assert(await S.orderOverageFeeCents(stub(2), T, [{ event_detail_id: 'e1', unit_price: 10, quantity: 1 }], 1000) === 0, 'tickets: geen orderfee');
  assert(await S.orderOverageFeeCents(stub(null, { message: 'boom' }), T, items, 5000) === 0, 'mislukte lookup: verkoop gaat door (cron registreert)');
  assert(await S.orderOverageFeeCents(stub(2), T, items, 0) === 0, 'gratis order: geen fee');
});

await check('kanalen en op voor vandaag (HORECA-CHANNELS-1)', async () => {
  const future = new Date(Date.now() + 3600e3).toISOString();
  const past = new Date(Date.now() - 3600e3).toISOString();
  assert(S.isSoldOutToday({ sold_out_until: future }) === true, 'op tot straks: uitverkocht');
  assert(S.isSoldOutToday({ sold_out_until: past }) === false, 'reset voorbij: weer te koop');
  assert(S.isSoldOutToday({}) === false, 'geen datum: te koop');
  assert(S.channelAllows({}, 'online') === true, 'oude rij zonder kanalen: overal');
  assert(S.channelAllows({ channels: ['table', 'menu'] }, 'online') === false, 'alleen tafel: niet online');
  assert(S.channelAllows({ channels: ['table'] }, 'menu') === true, 'aan tafel bestelbaar = ook op de kaart');
  assert(S.channelAllows({ channels: ['online'] }, 'menu') === false, 'alleen online: niet op de QR-kaart');
  const tableOnly = { product: { name: 'Tapbier', channels: ['table', 'menu'], sold_out_today: false } };
  const onlineOnly = { product: { name: 'Familiebox', channels: ['online'], sold_out_today: false } };
  const soldOut = { product: { name: 'Lasagne', channels: ['online', 'table'], sold_out_today: true } };
  assert(S.cartAvailabilityError([tableOnly], true) === null, 'tapbier aan tafel: ok');
  assert(S.cartAvailabilityError([tableOnly], false)?.code === 'NOT_AVAILABLE_ONLINE', 'tapbier online: geweigerd');
  assert(S.cartAvailabilityError([onlineOnly], true)?.code === 'NOT_AVAILABLE_AT_TABLE', 'familiebox aan tafel: geweigerd');
  assert(S.cartAvailabilityError([soldOut], false)?.code === 'SOLD_OUT', 'op voor vandaag: geweigerd');
});

await check('early bird per tickettype (EB-TYPES-1)', async () => {
  const future = new Date(Date.now() + 864e5).toISOString();
  const ev = { product_id: 'main', early_bird_price: 19, early_bird_deadline: future, early_bird_quantity: null };
  const price = (pid: string, typeEb: number | null, base: number) =>
    S.resolveEventPrice(S.earlyBirdForType(ev, pid, typeEb), base, 0, new Date()).price;
  assert(price('main', null, 25) === 19, 'standaardtype volgt de early bird van de datum');
  assert(price('vip', null, 40) === 40, 'VIP zonder eigen early bird: gewone prijs (niet €19)');
  assert(price('vip', 32, 40) === 32, 'VIP met eigen early bird: eigen prijs');
  const noPeriod = { ...ev, early_bird_deadline: null, early_bird_quantity: null };
  assert(S.resolveEventPrice(S.earlyBirdForType(noPeriod, 'vip', 32), 40, 0, new Date()).price === 40, 'extra type zonder periode: geen eindeloze korting');
  const over = { ...ev, early_bird_deadline: new Date(Date.now() - 864e5).toISOString() };
  assert(S.resolveEventPrice(S.earlyBirdForType(over, 'vip', 32), 40, 0, new Date()).price === 40, 'na de periode: gewone prijs');
});

await check('stoelstatus (ZAAL-2)', async () => {
  const now = Date.now();
  const base = { status: 'available', hold_cart_id: null, hold_expires_at: null, order_id: null, ticket_instance_id: null, product_id: 'p' };
  const later = new Date(now + 60_000).toISOString();
  const earlier = new Date(now - 60_000).toISOString();
  assert(S.seatPublicStatus(base, null, now) === 'available', 'vrije stoel');
  assert(S.seatPublicStatus({ ...base, product_id: null }, null, now) === 'unavailable', 'stoel zonder tickettype');
  assert(S.seatPublicStatus({ ...base, status: 'blocked' }, null, now) === 'unavailable', 'niet te koop');
  assert(S.seatPublicStatus({ ...base, status: 'held', hold_cart_id: 'c1', hold_expires_at: later }, 'c1', now) === 'mine', 'eigen vastgehouden stoel');
  assert(S.seatPublicStatus({ ...base, status: 'held', hold_cart_id: 'c2', hold_expires_at: later }, 'c1', now) === 'unavailable', 'stoel van een ander');
  assert(S.seatPublicStatus({ ...base, status: 'held', hold_cart_id: 'c2', hold_expires_at: earlier }, 'c1', now) === 'available', 'verlopen hold is weer vrij');
  assert(S.seatPublicStatus({ ...base, status: 'held', hold_cart_id: 'c1', hold_expires_at: later, order_id: 'o1' }, 'c1', now) === 'unavailable', 'stoel van een lopende order');
  assert(S.seatPublicStatus({ ...base, status: 'sold', ticket_instance_id: 't' }, 'c1', now) === 'unavailable', 'verkocht');
});

await check('kortingscode één keer per klant (DISCOUNT-LIMIT-1)', async () => {
  const now = Date.now();
  const iso = (ms: number) => new Date(now + ms).toISOString();
  const code = (c: string, extra: Record<string, unknown> = {}) => ({
    id: `dc-${c}`, tenant_id: T, code: c, discount_type: 'percentage', discount_value: 10, is_active: true,
    valid_from: null, valid_until: null, usage_limit: null, usage_count: 0, usage_limit_per_customer: 1,
    minimum_order_amount: null, maximum_discount_amount: null, applies_to: 'all', first_order_only: false, ...extra,
  });
  const order = (email: string, dc: string, payment_status: string, extra: Record<string, unknown> = {}) => ({
    id: `o-${email}-${payment_status}-${Math.random()}`, tenant_id: T, customer_email: email, discount_code: dc,
    payment_status, status: payment_status === 'paid' ? 'processing' : 'pending', expires_at: null, created_at: iso(-3600_000), ...extra,
  });
  const ddb = new FakeDb({
    discount_codes: [code('WELCOME10'), code('LIMIT2', { usage_limit: 2, usage_count: 1, usage_limit_per_customer: null })],
    discount_code_usage: [{ discount_code_id: 'dc-WELCOME10', order_id: null, customer_email: 'usage@x.be' }],
    customers: [{ id: 'cust-1', tenant_id: T, email: 'Paid@X.be' }],
    orders: [
      order('Paid@X.be', 'FREESHIP, WELCOME10', 'paid'),
      order('open@x.be', 'WELCOME10', 'pending', { expires_at: iso(86400_000) }),
      order('expired@x.be', 'WELCOME10', 'pending', { expires_at: iso(-60_000) }),
      order('cancelled@x.be', 'WELCOME10', 'paid', { status: 'cancelled' }),
      order('other@x.be', 'WELCOME100', 'paid'),
      order('x@x.be', 'LIMIT2', 'pending', { expires_at: iso(86400_000) }),
    ],
  });
  const v = (params: Record<string, unknown>) => S.validateDiscountCode(ddb, T, { code: 'welcome10', subtotal: 50, ...params });
  assert((await v({})).valid === true, 'zonder e-mail blijft de code geldig');
  assert((await v({ customer_email: 'new@x.be' })).valid === true, 'nieuwe klant');
  const used = await v({ customer_email: '  PAID@x.be ' });
  assert(used.valid === false && used.error === 'Je hebt deze kortingscode al gebruikt', `betaalde order, hoofdletters/spaties: ${JSON.stringify(used)}`);
  assert((await v({ customer_email: 'open@x.be' })).valid === false, 'openstaande overschrijving telt');
  assert((await v({ customer_email: 'expired@x.be' })).valid === true, 'vervallen overschrijving telt niet');
  assert((await v({ customer_email: 'cancelled@x.be' })).valid === true, 'geannuleerde order telt niet');
  assert((await v({ customer_email: 'other@x.be' })).valid === true, 'WELCOME100 is niet WELCOME10');
  assert((await v({ customer_email: 'usage@x.be' })).valid === false, 'vastgelegd gebruik zonder order telt');
  assert((await v({ customer_id: 'cust-1' })).valid === false, 'customer_id (klant-id) wordt opgezocht');
  assert((await v({ customer_id: 'paid@x.be' })).valid === false, 'customer_id met e-mailadres');
  const lim = await S.validateDiscountCode(ddb, T, { code: 'LIMIT2', subtotal: 50 });
  assert(lim.valid === false && lim.error === 'Deze kortingscode is niet meer beschikbaar', `usage_limit telt openstaande orders: ${JSON.stringify(lim)}`);
  // Interne uitzondering voor de cart van een al geplaatste order.
  const own = await S.validateDiscountCode(ddb, T, { code: 'WELCOME10', subtotal: 50, customer_email: 'paid@x.be' }, { skipUsageChecks: true });
  assert(own.valid === true, 'omgezette cart houdt zijn korting');
  // Promotiemotor: een al gebruikte code geeft geen korting, ook niet via cart_get.
  const promo = await S.computeCartTotals(ddb, T, { discount_codes: ['WELCOME10'], customer_email: 'paid@x.be' }, [{ product_id: 'p1', quantity: 2, unit_price: 25, line_total: 50 }]);
  assert(promo.discount_amount === 0, `al gebruikt → geen korting, kreeg ${promo.discount_amount}`);
  const promo2 = await S.computeCartTotals(ddb, T, { discount_codes: ['WELCOME10'], customer_email: 'new@x.be' }, [{ product_id: 'p1', quantity: 2, unit_price: 25, line_total: 50 }]);
  assert(promo2.discount_amount === 5, `nieuwe klant → 10%, kreeg ${promo2.discount_amount}`);
  const promo3 = await S.computeCartTotals(ddb, T, { discount_codes: ['WELCOME10'], customer_email: 'paid@x.be', checkout_status: 'converted' }, [{ product_id: 'p1', quantity: 2, unit_price: 25, line_total: 50 }]);
  assert(promo3.discount_amount === 5, `omgezette cart → korting blijft, kreeg ${promo3.discount_amount}`);
  assert(S.appliedCodesOnly(['WELCOME10', 'free'], [{ code: 'FREE' }]).join() === 'free', 'alleen toegepaste codes blijven');
});

// SEC-DOMAIN-2 — domeinresolutie en hreflang/sitemap tonen alleen DNS-geverifieerde domeinen.
// Een onverifieerde rij gedraagt zich als een onbekend domein; <slug>.sellqo.shop blijft werken.
await check('SEC-DOMAIN-2: resolve_domain, get_seo en get_sitemap_data alleen geverifieerd', async () => {
  const V = 'tenant-vx';
  const dom = (domain: string, extra: Record<string, unknown> = {}) => ({
    id: `d-${domain}`, tenant_id: V, domain, locale: 'nl', is_canonical: false, is_active: true, dns_verified: true, ssl_active: true, ...extra,
  });
  const ddb = new FakeDb({
    tenant_domains: [
      dom('shop.example.be', { is_canonical: true }), dom('shop.example.nl'),
      dom('vreemd-domein.example', { dns_verified: false, ssl_active: false }),
      dom('kaping.sellqo.shop', { dns_verified: false }), // onverifieerde rij op andermans gratis adres
      dom('uit.example', { is_active: false }),
    ],
    tenants: [{ id: V, slug: 'vx', name: 'VX' }, { id: 'tenant-kaping', slug: 'kaping', name: 'Kaping' }],
    tenant_theme_settings: [{ tenant_id: V, use_custom_frontend: true, custom_frontend_url: null }],
    fulfillment_settings: [],
    products: [{ id: 'p1', tenant_id: V, name: 'P', slug: 'p', meta_title: null, meta_description: null, is_active: true, hide_from_storefront: false, updated_at: 'x' }],
    categories: [], legal_pages: [],
  });
  const ok = await S.resolveDomain(ddb, { hostname: 'shop.example.nl' });
  assert(ok.tenant_id === V && ok.dns_verified === true, `geverifieerd: ${JSON.stringify(ok)}`);
  assert(JSON.stringify(Object.keys(ok)) === JSON.stringify(['tenant_id', 'tenant_slug', 'tenant_name', 'locale', 'is_canonical', 'dns_verified', 'ssl_active', 'use_custom_frontend', 'custom_frontend_url', 'shop_live', 'shop_ordering', 'qr_mode', 'all_domains']), 'sleutels ongewijzigd');
  assert(ok.all_domains.map((d: any) => d.domain).join() === 'shop.example.be,shop.example.nl', `all_domains: ${JSON.stringify(ok.all_domains)}`);
  for (const h of ['vreemd-domein.example', 'uit.example', 'bestaat-niet.example']) {
    let msg = '';
    try { await S.resolveDomain(ddb, { hostname: h }); } catch (e) { msg = e instanceof Error ? e.message : String(e); }
    assert(msg === 'Domain not found', `${h} moet onbekend zijn, kreeg '${msg}'`);
  }
  const shop = await S.resolveDomain(ddb, { hostname: 'kaping.sellqo.shop' });
  assert(shop.tenant_id === 'tenant-kaping', `onverifieerde rij gaat niet voor op het gratis adres: ${shop.tenant_id}`);
  const seo = await S.getSeo(ddb, V, { type: 'product', slug: 'p' });
  assert(seo.hreflang.map((h: any) => h.url).join() === 'https://shop.example.be/products/p,https://shop.example.nl/products/p', `hreflang: ${JSON.stringify(seo.hreflang)}`);
  const sm = await S.getSitemapData(ddb, V);
  assert(sm.base_url === 'https://shop.example.be' && sm.domains.length === 2, `sitemap: ${JSON.stringify(sm.domains)}`);
});

await check('cart_restore: herstel-link verlaten winkelmandje (MAIL-3)', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen
  type Row = Record<string, any>;
  Deno.env.set('MARKETING_LINK_SECRET', 'smoke-secret');
  const { signCartRestore } = await import('../../supabase/functions/_shared/cartRestoreToken.ts');
  const RT = '11111111-1111-4111-8111-111111111111';
  const RT2 = '22222222-2222-4222-8222-222222222222';
  const RUN = '33333333-3333-4333-8333-333333333333';
  const RUN_CONV = '44444444-4444-4444-8444-444444444444';
  const RUN_ERR = '55555555-5555-4555-8555-555555555555';
  const future = Math.floor(Date.now() / 1000) + 3600;
  const prod = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
    id, tenant_id: RT, name, slug: id, price: 10, is_active: true, track_inventory: true, stock: 5, category_id: null,
    channels: null, sold_out_until: null, images: [], product_type: 'physical', token_amount: null, ...extra,
  });
  const line = (id: string, product_id: string, extra: Record<string, unknown> = {}) => ({
    id, cart_id: 'old1', product_id, variant_id: null, event_detail_id: null, quantity: 1, unit_price: 10, addons: null,
    addons_total: 0, gift_card_metadata: null, created_at: `2026-10-19T10:00:0${id.slice(-1)}Z`, products: { name: id }, product_variants: null, ...extra,
  });
  const rdb = new FakeDb({
    tenants: [{ id: RT, tax_percentage: 21 }, { id: RT2, tax_percentage: 21 }],
    products: [prod('pa', 'Tee'), prod('pb', 'Uitverkocht', { stock: 0 }), prod('tk', 'Zaalticket', { product_type: 'ticket' })],
    product_variants: [{ id: 'va', product_id: 'pa', tenant_id: RT, title: 'M', price: 12, stock: 4, track_inventory: true, is_active: true }],
    event_details: [{ id: 'ev1', product_id: 'tk', tenant_id: RT, status: 'scheduled', venue_id: 'zaal1' }],
    automation_runs: [
      { id: RUN, tenant_id: RT, trigger_entity_id: 'old1', trigger_entity_type: 'cart', recipient_email: 'jan@voorbeeld.be' },
      { id: RUN_CONV, tenant_id: RT, trigger_entity_id: 'old2', trigger_entity_type: 'cart', recipient_email: 'piet@voorbeeld.be' },
      { id: RUN_ERR, tenant_id: RT, trigger_entity_id: 'old3', trigger_entity_type: 'cart', recipient_email: 'els@voorbeeld.be' },
    ],
    storefront_carts: [
      { id: 'old1', tenant_id: RT, session_id: 'x', currency: 'EUR', locale: 'nl', checkout_status: 'checkout', customer_email: 'jan@voorbeeld.be',
        customer_phone: '+32 470 00 00 00', shipping_address: { street: 'Geheim 1' }, discount_codes: ['WELKOM'], created_at: '2026-10-19T10:00:00Z', expires_at: '2999-01-01T00:00:00Z' },
      { id: 'old2', tenant_id: RT, session_id: 'y', currency: 'EUR', checkout_status: 'converted', customer_email: 'piet@voorbeeld.be', created_at: '2026-10-19T10:00:00Z', expires_at: '2999-01-01T00:00:00Z' },
      { id: 'old3', tenant_id: RT, session_id: 'z', currency: 'EUR', checkout_status: 'checkout', customer_email: 'els@voorbeeld.be', created_at: '2026-10-19T10:00:00Z', expires_at: '2999-01-01T00:00:00Z' },
    ],
    storefront_cart_items: [
      line('l1', 'pa', { variant_id: 'va', quantity: 2, product_variants: { title: 'M' } }),
      line('l2', 'pb'),
      line('l3', 'tk', { event_detail_id: 'ev1' }),
      line('l4', 'pa', { addons: [{ group: 'Saus', name: 'Mayo', price: 0.5 }] }),
      line('l5', 'pa', { gift_card_metadata: { recipient_email: 'x@y.be' } }),
      line('l6', 'pa', { cart_id: 'old3' }),
    ],
    orders: [],
  }, true);
  const restore = (tenant: string, token: string) => S.cartRestore(rdb, tenant, { token });
  const code = (r: Row) => r?.success === false ? r.error.code : 'OK';

  const good = await signCartRestore(RT, RUN, future);
  const forged = good.slice(0, -1) + (good.endsWith('A') ? 'B' : 'A');
  assert(code(await restore(RT, forged)) === 'RESTORE_INVALID', 'vervalst token moet RESTORE_INVALID geven');
  assert(code(await restore(RT, `v1.${RUN}.${future + 60}.${good.split('.')[3]}`)) === 'RESTORE_INVALID', 'opgerekte vervaldatum moet RESTORE_INVALID geven');
  assert(code(await restore(RT, await signCartRestore(RT, RUN, Math.floor(Date.now() / 1000) - 5))) === 'RESTORE_EXPIRED', 'verlopen token');
  assert(code(await restore(RT2, good)) === 'RESTORE_INVALID', 'token van winkel A bij winkel B');
  assert(code(await restore(RT2, await signCartRestore(RT2, RUN, future))) === 'RESTORE_INVALID', 'geldig token van winkel B voor een run van winkel A');
  assert(code(await restore(RT, await signCartRestore(RT, RUN_CONV, future))) === 'RESTORE_ORDERED', 'besteld mandje');
  assert(!rdb.tables.storefront_carts.some((c: Row) => String(c.session_id).startsWith('restore:')), 'na een weigering geen nieuw mandje');

  const r1: Row = await restore(RT, good);
  assert(code(r1) === 'OK' && r1.restored === 1 && r1.already_restored === false, `eerste herstel: ${JSON.stringify(r1)}`);
  const reasons = r1.skipped.map((s: Row) => s.reason).sort().join();
  assert(reasons === 'ADDONS,GIFT_CARD,INSUFFICIENT_STOCK,SEAT_SELECTION_REQUIRED', `redenen: ${reasons}`);
  assert(!JSON.stringify(r1).includes('old1') && !JSON.stringify(r1).includes('voorbeeld.be'), 'antwoord lekt oud cart_id of e-mail');
  const fresh = rdb.tables.storefront_carts.find((c: Row) => c.id === r1.cart_id);
  assert(fresh && fresh.session_id === `restore:${RUN}` && !fresh.customer_email && !fresh.shipping_address && !fresh.discount_codes && fresh.locale === 'nl', `nieuw mandje: ${JSON.stringify(fresh)}`);
  const newLines = rdb.tables.storefront_cart_items.filter((i: Row) => i.cart_id === r1.cart_id);
  assert(newLines.length === 1 && newLines[0].quantity === 2 && newLines[0].variant_id === 'va' && Number(newLines[0].unit_price) === 12, `regels: ${JSON.stringify(newLines)}`);

  const r2: Row = await restore(RT, good);
  assert(r2.cart_id === r1.cart_id && r2.already_restored === true && r2.restored === 0, `tweede klik: ${JSON.stringify(r2)}`);
  assert(rdb.tables.storefront_cart_items.filter((i: Row) => i.cart_id === r1.cart_id).length === 1, 'tweede klik kopieert niet opnieuw');
  assert(rdb.tables.storefront_carts.filter((c: Row) => String(c.session_id).startsWith('restore:')).length === 1, 'één hersteld mandje');
  const oldCart = rdb.tables.storefront_carts.find((c: Row) => c.id === 'old1');
  assert(oldCart.checkout_status === 'checkout' && rdb.tables.storefront_cart_items.filter((i: Row) => i.cart_id === 'old1').length === 5, 'oud mandje ongemoeid');

  // Review-fix 1: hersteld mandje al in de checkout → geen cart_id, geen klantgegevens.
  fresh.checkout_status = 'checkout';
  fresh.customer_email = 'jan@voorbeeld.be';
  fresh.shipping_address = { street: 'Geheim 1' };
  const r3: Row = await restore(RT, good);
  assert(code(r3) === 'RESTORE_IN_CHECKOUT' && !('cart_id' in r3), `in checkout: ${JSON.stringify(r3)}`);
  assert(!JSON.stringify(r3).includes(r1.cart_id) && !JSON.stringify(r3).includes('voorbeeld.be') && !JSON.stringify(r3).includes('Geheim'), 'checkout-antwoord lekt mandje of gegevens');
  assert(rdb.tables.storefront_carts.filter((c: Row) => String(c.session_id).startsWith('restore:')).length === 1, 'in checkout: geen tweede mandje');
  fresh.checkout_status = 'converted';
  assert(code(await restore(RT, good)) === 'RESTORE_ORDERED', 'besteld via het herstelde mandje');

  // Review-fix 2: limiet per run (10 per 10 min) na de handtekeningcontrole. Tot hier 5 geldige
  // aanroepen voor RUN (winkel B met run A, r1, r2, r3, besteld); een andere run telt apart.
  const left: string[] = [];
  for (let i = 0; i < 6; i++) left.push(code(await restore(RT, good)));
  assert(left.slice(0, 5).every((c) => c === 'RESTORE_ORDERED') && left[5] === 'RATE_LIMITED', `limiet per run: ${left.join()}`);
  assert(code(await restore(RT, await signCartRestore(RT, RUN_CONV, future))) === 'RESTORE_ORDERED', 'andere run niet geremd');
  const RT3 = '66666666-6666-4666-8666-666666666666';
  let brake = '';
  for (let i = 0; i < 301; i++) brake = code(await restore(RT3, 'rommel'));
  assert(brake === 'RATE_LIMITED', `rem per winkel na 300: ${brake}`);

  // Review-fix 3: storing na het aanmaken → mandje op 'expired', fout gooien (geen blijvende
  // UNAVAILABLE), en de volgende klik begint opnieuw.
  const errQ: Row = new Proxy({}, {
    get: (_t, k) => k === 'then'
      ? (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'tijdelijke storing' } }).then(res)
      : () => errQ,
  });
  const flaky = { from: (t: string) => (t === 'products' ? errQ : rdb.from(t)), rpc: () => rdb.rpc() };
  const errTok = await signCartRestore(RT, RUN_ERR, future);
  let thrown = '';
  try { await S.cartRestore(flaky, RT, { token: errTok }); } catch (e) { thrown = (e as Row)?.message ?? String(e); }
  assert(thrown === 'tijdelijke storing', `storing moet gooien, kreeg '${thrown}'`);
  const half = rdb.tables.storefront_carts.find((c: Row) => c.session_id === `restore:${RUN_ERR}`);
  const mark = rdb.writes.find((w: Row) => w.table === 'storefront_carts' && w.patch?.checkout_status === 'expired' && w.where?.id === half?.id);
  assert(half && mark, `half mandje niet op expired gezet: ${JSON.stringify(mark)}`);
  Object.assign(half, mark.patch); // de nep-databank voert updates niet uit; hier wel, zoals de echte
  const again: Row = await restore(RT, errTok);
  assert(code(again) === 'OK' && again.cart_id !== half.id && again.restored === 1 && again.already_restored === false, `opnieuw na storing: ${JSON.stringify(again)}`);
});

// CART-PRICE-1 — mandje en betaling rekenen met de actuele prijs, niet met de prijs van bij
// het toevoegen. Nep-databank met vooraf gejoinde regels (products/product_variants).
{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde rijen
  type R = Record<string, any>;
  const PT = 'tenant-price';
  const prod = (id: string, price: number) => ({ id, tenant_id: PT, name: id, slug: id, images: [], price, sku: null, track_inventory: false, stock: 0, category_id: null, channels: null, sold_out_until: null, product_type: 'physical', token_amount: null, is_active: true });
  const P: Record<string, R> = { pa: prod('pa', 25), pb: prod('pb', 15), pc: prod('pc', 30), pn: prod('pn', 33), pd: prod('pd', 10), pt: prod('pt', 25), pt2: prod('pt2', 30) };
  const line = (id: string, cart: string, pid: string, unit: number, extra: R = {}) => ({
    id, cart_id: cart, product_id: pid, variant_id: null, event_detail_id: null, quantity: 1, unit_price: unit,
    addons: null, addons_total: null, gift_card_metadata: null, products: P[pid], product_variants: null, ...extra,
  });
  const past = '2020-01-01T00:00:00Z';
  const soon = '2999-01-01T00:00:00Z';
  const pdb = new FakeDb({
    tenants: [{ id: PT, tax_percentage: 21, stripe_account_id: 'acct_test', currency: 'EUR', pass_transaction_fee_to_customer: false, country: 'BE' }],
    storefront_carts: [
      { id: 'pc1', tenant_id: PT, session_id: 'ps1', currency: 'EUR', discount_codes: [], expires_at: soon, checkout_status: 'checkout', customer_email: 'k@example.test', shipping_method_id: null, shipping_cost: 0 },
      { id: 'pc2', tenant_id: PT, session_id: 'ps2', currency: 'EUR', discount_codes: [], expires_at: soon, checkout_status: 'shopping' },
    ],
    storefront_cart_items: [
      line('A', 'pc1', 'pa', 20),                                   // prijs verhoogd na toevoegen
      line('B', 'pc1', 'pb', 18),                                   // prijs verlaagd
      line('C', 'pc1', 'pc', 40, { variant_id: 'vc', product_variants: { price: 40, compare_at_price: null } }), // variant ongewijzigd
      line('N', 'pc1', 'pn', 30, { variant_id: 'vn', product_variants: { price: null, compare_at_price: null } }), // variant zonder eigen prijs
      line('D', 'pc1', 'pd', 11, { addons: [{ group_id: 'g', group: 'Extra', option_id: 'oa', name: 'Kaas', price: 1 }], addons_total: 1, addon_key: 'oa' }),
      line('T1', 'pc2', 'pt', 19, { event_detail_id: 'ev1' }),     // early bird verlopen
      line('T2', 'pc2', 'pt', 19, { event_detail_id: 'ev2' }),     // early bird loopt nog
      line('T3', 'pc2', 'pt2', 22, { event_detail_id: 'ev2' }),    // ander tickettype, eigen early bird
    ],
    product_variants: [
      { id: 'vc', product_id: 'pc', tenant_id: PT, title: 'L', image_url: null, attribute_values: {}, price: 40, stock: 5, track_inventory: false, sku: null },
      { id: 'vn', product_id: 'pn', tenant_id: PT, title: 'M', image_url: null, attribute_values: {}, price: null, stock: 5, track_inventory: false, sku: null },
    ],
    product_addon_options: [{ id: 'oa', group_id: 'g', tenant_id: PT, name: 'Kaas', price: 1.5, is_active: true }],
    event_details: [
      { id: 'ev1', tenant_id: PT, product_id: 'pt', early_bird_price: 19, early_bird_deadline: past, early_bird_quantity: null, venue_id: null, event_date: '2999-01-01' },
      { id: 'ev2', tenant_id: PT, product_id: 'pt', early_bird_price: 19, early_bird_deadline: soon, early_bird_quantity: null, venue_id: null, event_date: '2999-01-01' },
    ],
    event_ticket_types: [{ event_detail_id: 'ev2', product_id: 'pt2', tenant_id: PT, early_bird_price: 22, is_active: true }],
    event_seats: [], ticket_bundle_items: [], shipping_methods: [], fulfillment_settings: [], orders: [], customers: [],
    product_categories: [], categories: [], volume_discounts: [], bogo_promotions: [], product_bundles: [], automatic_discounts: [],
    discount_stacking_rules: [], discount_codes: [], customer_groups: [], vat_rates: [], tax_rates: [],
  });
  const byId = (items: R[]) => Object.fromEntries(items.map((i) => [i.id, i]));

  await check('cart_get: actuele prijs + price_changed (CART-PRICE-1)', async () => {
    const c: R = await S.cartGet(pdb, PT, { cart_id: 'pc1' });
    const it = byId(c.items);
    assert(it.A.unit_price === 25 && it.A.price_changed === true && it.A.previous_unit_price === 20, `verhoogd: ${JSON.stringify(it.A)}`);
    assert(it.B.unit_price === 15 && it.B.previous_unit_price === 18, `verlaagd: ${JSON.stringify(it.B)}`);
    assert(it.C.unit_price === 40 && !('price_changed' in it.C) && !('previous_unit_price' in it.C), `variant ongewijzigd: ${JSON.stringify(it.C)}`);
    assert(it.N.unit_price === 33 && it.N.price_changed === true, `variant zonder prijs volgt product: ${JSON.stringify(it.N)}`);
    assert(it.D.unit_price === 11.5 && it.D.addons[0].price === 1.5 && it.D.line_total === 11.5, `extra's: ${JSON.stringify(it.D)}`);
    assert(c.subtotal === 124.5, `subtotaal ${c.subtotal}`);
    assert(!pdb.writes.some((w: R) => w.table === 'storefront_cart_items'), 'cart_get schrijft geen prijzen');
  });
  await check('cart_get: tickets volgen de early-bird-regel (CART-PRICE-1)', async () => {
    const it = byId(((await S.cartGet(pdb, PT, { cart_id: 'pc2' })) as R).items);
    assert(it.T1.unit_price === 25 && it.T1.previous_unit_price === 19, `early bird verlopen: ${JSON.stringify(it.T1)}`);
    assert(it.T2.unit_price === 19 && !it.T2.price_changed, `early bird loopt: ${JSON.stringify(it.T2)}`);
    assert(it.T3.unit_price === 22 && !it.T3.price_changed, `tickettype-early-bird: ${JSON.stringify(it.T3)}`);
  });
  await check('getCartForCheckout rekent met de actuele prijs (CART-PRICE-1)', async () => {
    const c: R = await S.getCartForCheckout(pdb, PT, 'pc1');
    const it = byId(c.cartItems);
    assert(c.subtotal === 124.5 && it.A.unit_price === 25 && it.B.unit_price === 15 && it.N.unit_price === 33, `checkout ${c.subtotal}`);
  });
  await check('checkout_complete: Stripe vraagt de nieuwe prijs, regels vastgelegd (CART-PRICE-1)', async () => {
    pdb.writes.length = 0;
    const sessions: R[] = ((globalThis as R).__stripeSessions ||= []);
    sessions.length = 0;
    const r: R = await S.checkoutComplete(pdb, PT, { cart_id: 'pc1', payment_method_id: 'bancontact', success_url: 'https://s.test/ok', cancel_url: 'https://s.test/x' });
    assert(r.payment_type === 'redirect' && sessions.length === 1, `checkout ${JSON.stringify(r)}`);
    const amounts = sessions[0].line_items.map((li: R) => li.price_data.unit_amount);
    assert(JSON.stringify(amounts) === JSON.stringify([2500, 1500, 4000, 3300, 1150]), `Stripe-bedragen ${amounts}`);
    const w = pdb.writes.filter((x: R) => x.table === 'storefront_cart_items' && x.patch);
    const ids = w.map((x: R) => x.where.id).sort().join(',');
    assert(ids === 'A,B,D,N', `vastgelegde regels ${ids}`);
    const wd = w.find((x: R) => x.where.id === 'D');
    assert(wd.patch.unit_price === 11.5 && wd.patch.addons_total === 1.5 && wd.patch.addons[0].price === 1.5, `extra's vastgelegd ${JSON.stringify(wd.patch)}`);
  });
}

if (failures > 0) { console.error(`${failures} rooktest(en) gefaald`); Deno.exit(1); }
console.log('Rooktest storefront-api groen.');
