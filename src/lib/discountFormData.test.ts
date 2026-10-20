import { describe, expect, it } from 'vitest';
import { buildDiscountFormData, type DiscountFormValues } from './discountFormData';

const base = (over: Partial<DiscountFormValues> = {}): DiscountFormValues => ({
  code: 'ZOMER2026',
  description: '',
  discount_type: 'percentage',
  discount_value: 10,
  minimum_order_amount: null,
  maximum_discount_amount: null,
  usage_limit: null,
  usage_limit_per_customer: null,
  valid_from: null,
  valid_until: null,
  is_active: true,
  applies_to: 'all',
  first_order_only: false,
  product_ids: [],
  category_ids: [],
  ...over,
});

describe('buildDiscountFormData', () => {
  it('ongewijzigde datum (oude stijl, middernacht UTC) blijft byte-identiek', () => {
    const stored = { valid_from: '2026-10-01T00:00:00+00:00', valid_until: '2026-10-31T00:00:00+00:00' };
    const out = buildDiscountFormData(base({ valid_from: '2026-10-01', valid_until: '2026-10-31' }), stored);
    expect(out.valid_from).toBe(stored.valid_from);
    expect(out.valid_until).toBe(stored.valid_until);
  });

  it('ongewijzigde datum (nieuwe stijl, einde lokale dag) blijft byte-identiek', () => {
    const stored = { valid_from: '2026-10-23T22:00:00.000Z', valid_until: '2026-10-24T21:59:59.999Z' };
    const out = buildDiscountFormData(base({ valid_from: '2026-10-24', valid_until: '2026-10-24' }), stored);
    expect(out.valid_from).toBe(stored.valid_from);
    expect(out.valid_until).toBe(stored.valid_until);
  });

  it('nieuw gekozen dag → begin/einde van de lokale dag (ook over de DST-omschakeling)', () => {
    const stored = { valid_from: '2026-10-01T00:00:00+00:00', valid_until: '2026-10-31T00:00:00+00:00' };
    const out = buildDiscountFormData(base({ valid_from: '2026-10-25', valid_until: '2026-10-25' }), stored);
    expect(out.valid_from).toBe('2026-10-24T22:00:00.000Z');
    expect(out.valid_until).toBe('2026-10-25T22:59:59.999Z');
  });

  it('gewiste datum → null, ook als er iets opgeslagen was', () => {
    const stored = { valid_from: '2026-10-01T00:00:00+00:00', valid_until: '2026-10-31T00:00:00+00:00' };
    const out = buildDiscountFormData(base({ valid_from: null, valid_until: '' }), stored);
    expect(out.valid_from).toBeNull();
    expect(out.valid_until).toBeNull();
  });

  it('product_ids/category_ids blijven exact behouden bij update', () => {
    const product_ids = ['p-2', 'p-1', 'p-3'];
    const category_ids = ['c-9'];
    const out = buildDiscountFormData(
      base({ applies_to: 'specific_products', product_ids, category_ids }),
      { valid_from: null, valid_until: null },
    );
    expect(out.applies_to).toBe('specific_products');
    expect(out.product_ids).toEqual(['p-2', 'p-1', 'p-3']);
    expect(out.category_ids).toEqual(['c-9']);
  });

  it('nieuwe code → zelfde velden als voorheen', () => {
    const out = buildDiscountFormData(base({ minimum_order_amount: 0, usage_limit: 5 }), null);
    expect(Object.keys(out).sort()).toEqual([
      'applies_to', 'category_ids', 'code', 'description', 'discount_type', 'discount_value',
      'first_order_only', 'is_active', 'maximum_discount_amount', 'minimum_order_amount',
      'product_ids', 'usage_limit', 'usage_limit_per_customer', 'valid_from', 'valid_until',
    ]);
    expect(out).toEqual({
      code: 'ZOMER2026',
      description: '',
      discount_type: 'percentage',
      discount_value: 10,
      minimum_order_amount: null,
      maximum_discount_amount: null,
      usage_limit: 5,
      usage_limit_per_customer: null,
      valid_from: null,
      valid_until: null,
      is_active: true,
      applies_to: 'all',
      product_ids: [],
      category_ids: [],
      first_order_only: false,
    });
  });

  it('nieuwe code met datums → begin/einde lokale dag', () => {
    const out = buildDiscountFormData(base({ valid_from: '2026-11-01', valid_until: '2026-11-30' }));
    expect(out.valid_from).toBe('2026-10-31T23:00:00.000Z');
    expect(out.valid_until).toBe('2026-11-30T22:59:59.999Z');
  });
});
