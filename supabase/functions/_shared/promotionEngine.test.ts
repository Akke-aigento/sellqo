// PROMO-ENGINE-1 — unit tests for the pure promotion engine.
// Run: deno test --no-lock supabase/functions/_shared/promotionEngine.test.ts
// (no network: no remote imports on purpose, so this runs anywhere)
import { evaluatePromotions, type EvaluateInput, type PromoItem, type PromotionData, type ValidatedCode } from './promotionEngine.ts';

function eq(actual: unknown, expected: unknown, msg = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  expected ${e}\n  got      ${a}`);
}

const NOW = new Date('2026-10-13T12:00:00Z');
const noData: PromotionData = { volume: [], bogo: [], bundles: [], automatic: [], stacking: [], groups: [] };
const item = (product_id: string, quantity: number, unit_price: number, category_ids: string[] = []): PromoItem =>
  ({ product_id, quantity, unit_price, line_total: quantity * unit_price, category_ids });
const run = (items: PromoItem[], data: Partial<PromotionData> = {}, extra: Partial<EvaluateInput> = {}) =>
  evaluatePromotions({
    items, subtotal: items.reduce((s, i) => s + i.line_total, 0),
    data: { ...noData, ...data }, codes: [], isFirstOrder: null, now: NOW, ...extra,
  });
const code = (c: string, v: Record<string, unknown>) => ({ raw: c, result: { valid: true, code: c, applies_to: 'all', ...v } as ValidatedCode });

Deno.test('no promotions → no discount', () => {
  eq(run([item('a', 2, 10)]), { discount_total: 0, applied_discounts: [], free_shipping: false, canonical_code: null });
});

Deno.test('volume: Loveke for Two (7% from 2 items)', () => {
  const volume = [{ name: 'Loveke for Two', applies_to: 'all', valid_from: null, valid_until: null,
    volume_discount_tiers: [{ min_quantity: 2, max_quantity: null, discount_type: 'percentage', discount_value: '7' }] }];
  eq(run([item('a', 1, 35.95)], { volume }).discount_total, 0, 'one item');
  eq(run([item('a', 2, 35.95)], { volume }).discount_total, 5.03, 'two items');
  eq(run([item('a', 1, 35.95)], { volume }, { now: NOW }).applied_discounts, []);
});

Deno.test('code: percentage on whole cart, free shipping, invalid ignored, canonical first code', () => {
  const r = run([item('a', 2, 50)], {}, { codes: [
    { raw: 'nope', result: { valid: false } }, code('WELCOME10', { discount_type: 'percentage', discount_value: '10.00' }),
    code('GRATIS', { discount_type: 'free_shipping', discount_value: 0 }),
  ] });
  eq(r.discount_total, 10);
  eq(r.free_shipping, true);
  eq(r.canonical_code, 'WELCOME10');
  eq(r.applied_discounts, [{ code: 'WELCOME10', description: '10.00% korting', amount: 10 }, { code: 'GRATIS', description: 'Gratis verzending', amount: 0 }]);
});

Deno.test('code restricted to products uses only those lines', () => {
  const r = run([item('a', 1, 100), item('b', 1, 40)], {}, { codes: [code('B20', { discount_type: 'percentage', discount_value: 20, applies_to: 'specific_products', product_ids: ['b'] })] });
  eq(r.discount_total, 8);
});

Deno.test('discount never exceeds subtotal', () => {
  const r = run([item('a', 1, 5)], {}, { codes: [code('TIEN', { discount_type: 'fixed_amount', discount_value: 10 })] });
  eq(r.discount_total, 5);
});

Deno.test('bogo: buy 2 get 1 free (same product), cheapest first', () => {
  const bogo = [{ name: '3 voor 2', promotion_type: 'buy_x_get_y_same', buy_quantity: 2, get_quantity: 1, discount_type: 'free',
    discount_value: 100, buy_product_ids: ['a'], valid_from: null, valid_until: null }];
  eq(run([item('a', 3, 10)], { bogo }).discount_total, 10);
  eq(run([item('a', 1, 10)], { bogo }).discount_total, 0);
});

Deno.test('automatic: cart total threshold, free shipping, first order fails closed without email', () => {
  const automatic = [
    { name: '5 euro vanaf 50', trigger_type: 'cart_total', trigger_value: 50, discount_type: 'fixed_amount', discount_value: 5, valid_from: null, valid_until: null, schedule: null },
    { name: 'Gratis verzending', trigger_type: 'item_count', trigger_value: 3, discount_type: 'free_shipping', discount_value: 0, valid_from: null, valid_until: null, schedule: null },
    { name: 'Welkom', trigger_type: 'first_order', discount_type: 'percentage', discount_value: 10, valid_from: null, valid_until: null, schedule: null },
  ];
  const r = run([item('a', 3, 20)], { automatic });
  eq(r.discount_total, 5);
  eq(r.free_shipping, true);
  eq(run([item('a', 3, 20)], { automatic }, { isFirstOrder: true }).discount_total, 11);
  eq(run([item('a', 3, 20)], { automatic }, { isFirstOrder: false }).discount_total, 5);
});

Deno.test('expired or future promotions do not apply', () => {
  const automatic = [{ name: 'oud', trigger_type: 'schedule', discount_type: 'percentage', discount_value: 50, valid_from: null, valid_until: '2026-01-01T00:00:00Z', schedule: null }];
  eq(run([item('a', 1, 10)], { automatic }).discount_total, 0);
});

Deno.test('customer group: lowest priority wins, min order respected', () => {
  const groups = [
    { name: 'Groothandel', is_active: true, discount_type: 'percentage', discount_value: 15, priority: 1, min_order_amount: null },
    { name: 'VIP', is_active: true, discount_type: 'percentage', discount_value: 5, priority: 2, min_order_amount: null },
  ];
  eq(run([item('a', 1, 100)], { groups }).applied_discounts, [{ code: null, description: 'Groothandel', amount: 15, type: 'customer_group' }]);
  eq(run([item('a', 1, 100)], { groups: [{ ...groups[0], min_order_amount: 200 }] }).discount_total, 0);
});

Deno.test('stacking: no_stacking keeps only the best discount, plus free shipping', () => {
  const volume = [{ name: 'Staffel', applies_to: 'all', volume_discount_tiers: [{ min_quantity: 2, discount_type: 'percentage', discount_value: 10 }] }];
  const r = run([item('a', 2, 50)], { volume, stacking: [{ rule_type: 'no_stacking' }] }, { codes: [
    code('TWINTIG', { discount_type: 'percentage', discount_value: 20 }), code('GRATIS', { discount_type: 'free_shipping', discount_value: 0 }),
  ] });
  eq(r.discount_total, 20);
  eq(r.free_shipping, true);
});

Deno.test('stacking: max total percent caps the sum', () => {
  const volume = [{ name: 'Staffel', applies_to: 'all', volume_discount_tiers: [{ min_quantity: 1, discount_type: 'percentage', discount_value: 10 }] }];
  const r = run([item('a', 1, 100)], { volume, stacking: [{ rule_type: 'stacking', max_total_discount_percent: 15 }] }, { codes: [
    code('TIEN', { discount_type: 'percentage', discount_value: 10 }),
  ] });
  eq(r.discount_total, 10);
});
