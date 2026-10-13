/* eslint-disable @typescript-eslint/no-explicit-any -- testharnas: ongetypeerde databankrijen */
// PROMO-ENGINE-1 comparison test: legacy storefront-api (747a79a) vs new, on live data.
// Usage: deno run --allow-read --import-map=import_map.json compare.ts <functionsDir>
import { FakeDb } from './fakeSupabase.ts';

const dir = Deno.args[0];
const L = await import(`file://${dir}/storefront-api/__cmp_legacy.ts`);
const N = await import(`file://${dir}/storefront-api/__cmp_new.ts`);
const E = await import(`file://${dir}/_shared/promotionEngine.ts`);
const fx = JSON.parse(await Deno.readTextFile(new URL('./fixture.json', import.meta.url)));

const tables: Record<string, any[]> = { ...fx };
const tenantName = Object.fromEntries(fx.tenants.map((t: any) => [t.id, t.name]));

interface Scenario { label: string; tenant_id: string; cart: any; lines: any[] }
const scenarios: Scenario[] = [];

// 1. Every real cart with items.
for (const c of fx.carts) {
  const lines = fx.items.filter((i: any) => i.cart_id === c.id).map((i: any) => ({
    product_id: i.product_id, variant_id: i.variant_id, quantity: i.quantity,
    unit_price: Number(i.unit_price), line_total: i.quantity * Number(i.unit_price),
  }));
  scenarios.push({ label: `cart ${c.id.slice(0, 8)}${c.live ? ' (live)' : ''}`, tenant_id: c.tenant_id, cart: { ...c }, lines });
}

// 2. Synthetic carts per tenant: product mixes × codes × customer × shipping.
const byTenant = new Map<string, any[]>();
for (const p of fx.sample_products) { if (!byTenant.has(p.tenant_id)) byTenant.set(p.tenant_id, []); byTenant.get(p.tenant_id)!.push(p); }
const paidEmail = new Map<string, string>();
for (const o of fx.orders) paidEmail.set(o.tenant_id, o.customer_email);
for (const [tid, prods] of byTenant) {
  const line = (p: any, q: number) => ({ product_id: p.id, variant_id: null, quantity: q, unit_price: Number(p.price), line_total: q * Number(p.price) });
  const mixes: any[][] = [];
  for (const p of prods) for (const q of [1, 2, 3, 5]) mixes.push([line(p, q)]);
  if (prods.length >= 2) mixes.push([line(prods[0], 1), line(prods[1], 1)]);
  mixes.push(prods.map((p) => line(p, 1)));
  mixes.push(prods.map((p) => line(p, 2)));
  const codes = fx.discount_codes.filter((d: any) => d.tenant_id === tid).map((d: any) => d.code);
  const codeSets: string[][] = [[], ...codes.map((c: string) => [c]), ...(codes.length > 1 ? [codes] : []), ['NOPE'], codes.map((c: string) => c.toLowerCase())];
  const emails = [null, 'new-customer-hash', paidEmail.get(tid) ?? null].filter((e, i, a) => a.indexOf(e) === i);
  const methods = [null, ...fx.shipping_methods.filter((m: any) => m.tenant_id === tid && m.is_active).map((m: any) => m.id)];
  let n = 0;
  for (const lines of mixes) for (const cs of codeSets) for (const em of emails) for (const sm of methods) {
    scenarios.push({ label: `synthetic ${n++}`, tenant_id: tid, cart: { id: 'syn', tenant_id: tid, discount_codes: cs, customer_email: em, shipping_method_id: sm, shipping_cost: 0, discount_amount: 0 }, lines });
  }
}

const db = new FakeDb(tables);
const stableJson = (v: any) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.fromEntries(Object.entries(x).sort()) : x);

let cartSame = 0, cartDiff = 0, coSame = 0;
const coDiff: Record<string, number> = {};
const examples: string[] = [];
for (const s of scenarios) {
  // cart_get path
  const a = await L.computeCartTotals(db, s.tenant_id, s.cart, s.lines);
  const b = await N.computeCartTotals(db, s.tenant_id, s.cart, s.lines);
  if (stableJson(a) === stableJson(b)) cartSame++; else {
    cartDiff++;
    if (examples.length < 15) examples.push(`CART DIFF ${tenantName[s.tenant_id]} ${s.label}\n  legacy ${stableJson(a)}\n  new    ${stableJson(b)}`);
  }
  // checkout path: legacy buildCartResponse loop vs engine
  const subtotal = s.lines.reduce((x: number, l: any) => x + l.line_total, 0);
  let legacy = 0; let legacyFree = false;
  for (const dc of s.cart.discount_codes || []) {
    const v = await L.validateDiscountCode(db, s.tenant_id, { code: dc, subtotal, customer_email: s.cart.customer_email });
    if (!v.valid) continue;
    if (v.discount_type === 'free_shipping') legacyFree = true;
    else legacy += L.calculateDiscountValue(subtotal, v.discount_type, v.discount_value, v.max_discount_amount);
  }
  const promo = await E.computeCartPromotions(db, s.tenant_id, s.cart, s.lines, N.promoValidator(db, s.tenant_id));
  const same = Math.abs(Math.round(legacy * 100) / 100 - promo.discount_total) < 0.005 && legacyFree === promo.free_shipping;
  if (same) coSame++; else {
    const kinds = promo.applied_discounts.map((d: any) => d.type || 'code').join('+');
    const key = `${tenantName[s.tenant_id]} [${kinds}]`;
    coDiff[key] = (coDiff[key] || 0) + 1;
    if (examples.length < 25) examples.push(`CHECKOUT DIFF ${key} ${s.label}: legacy ${legacy.toFixed(2)}/${legacyFree} → new ${promo.discount_total}/${promo.free_shipping}`);
  }
}
console.log(`scenarios: ${scenarios.length}`);
console.log(`cart_get (computeCartTotals): identical ${cartSame}, different ${cartDiff}`);
console.log(`checkout discount: identical ${coSame}, different ${scenarios.length - coSame}`);
console.log('checkout differences by tenant/kind:', coDiff);
console.log(examples.join('\n'));
console.log(`db writes during test: ${db.writes.length}`);
