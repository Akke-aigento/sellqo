import { describe, expect, it } from 'vitest';
import { calculatePosTotals, receiptVatLines, vatLabel } from '@/lib/calculations/posTotals';
import type { POSCartItem } from '@/types/pos';

const item = (price: number, qty: number, rate: number, discount = 0): POSCartItem =>
  ({ id: `${price}-${rate}`, product_id: 'p', name: 'x', sku: null, price, quantity: qty, tax_rate: rate, discount, total: price * qty - discount });

describe('APP-CLEAN-3c btw per tarief', () => {
  it('splitst 21% en 6% (inclusief) en telt op tot taxTotal', () => {
    const t = calculatePosTotals([item(121, 1, 21), item(10.6, 1, 6)], null, 'inclusive');
    expect(t.vatLines).toEqual([{ rate: 21, base: 100, tax: 21 }, { rate: 6, base: 10, tax: 0.6 }]);
    expect(t.taxTotal).toBe(21.6);
    expect(t.total).toBe(131.6);
  });
  it('verdeelt een mandkorting proportioneel', () => {
    const t = calculatePosTotals([item(121, 1, 21)], { type: 'fixed', value: 12.1 }, 'inclusive');
    expect(t.total).toBe(108.9);
    expect(t.vatLines[0].tax).toBe(18.9);
  });
  it('ticket: herberekent uit de opgeslagen transactie, incl. mandkorting', () => {
    const items = [item(121, 1, 21)];
    const lines = receiptVatLines({ items, discount_total: 12.1, tax_total: 18.9 }, 'inclusive');
    expect(lines).toEqual([{ rate: 21, base: 90, tax: 18.9 }]);
  });
  it('ticket: null als de som niet klopt (oude data) → geen verzonnen percentage', () => {
    expect(receiptVatLines({ items: [item(121, 1, 21)], discount_total: 0, tax_total: 25.41 }, 'inclusive')).toBeNull();
  });
  it('label', () => {
    expect(vatLabel(21)).toBe('BTW 21%');
    expect(vatLabel(5.5)).toBe('BTW 5,5%');
  });
});
