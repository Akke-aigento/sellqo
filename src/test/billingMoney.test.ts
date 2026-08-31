import { describe, it, expect } from 'vitest';
import { computeVatTotals, round2 } from '../../supabase/functions/_shared/billingMoney.ts';

// BILLING-1: btw sommeren per tarief-groep, dan pas afronden.

describe('computeVatTotals', () => {
  it('lost de per-regel-drift op (3 x 9,99 @ 21%)', () => {
    const lines = [
      { net: 9.99, vatRate: 21 },
      { net: 9.99, vatRate: 21 },
      { net: 9.99, vatRate: 21 },
    ];
    const t = computeVatTotals(lines);
    // Per regel afronden gaf 3 x 2,10 = 6,30. Per groep is het 21% over 29,97.
    expect(t.subtotal).toBe(29.97);
    expect(t.vatAmount).toBe(6.29);
    expect(t.total).toBe(36.26);
    expect(t.perRate).toEqual([{ rate: 21, net: 29.97, vat: 6.29 }]);
  });

  it('splitst gemengde tarieven per groep, aflopend gesorteerd', () => {
    const t = computeVatTotals([
      { net: 100, vatRate: 6 },
      { net: 50, vatRate: 21 },
      { net: 50, vatRate: 21 },
    ]);
    expect(t.perRate).toEqual([
      { rate: 21, net: 100, vat: 21 },
      { rate: 6, net: 100, vat: 6 },
    ]);
    expect(t.subtotal).toBe(200);
    expect(t.vatAmount).toBe(27);
    expect(t.total).toBe(227);
  });

  it('levert geen btw bij 0%', () => {
    const t = computeVatTotals([{ net: 250, vatRate: 0 }]);
    expect(t.vatAmount).toBe(0);
    expect(t.total).toBe(250);
    expect(t.perRate).toEqual([{ rate: 0, net: 250, vat: 0 }]);
  });

  it('geeft nullen op lege invoer', () => {
    const t = computeVatTotals([]);
    expect(t).toEqual({ subtotal: 0, vatAmount: 0, total: 0, perRate: [] });
  });

  it('behandelt onbruikbare waarden als 0 in plaats van NaN', () => {
    const t = computeVatTotals([
      { net: Number.NaN, vatRate: 21 },
      { net: 10, vatRate: Number.NaN },
    ]);
    expect(t.subtotal).toBe(10);
    expect(t.vatAmount).toBe(0);
    expect(Number.isNaN(t.total)).toBe(false);
  });

  it('houdt kop en som van de tarief-groepen sluitend', () => {
    const lines = Array.from({ length: 17 }, () => ({ net: 3.33, vatRate: 21 }));
    const t = computeVatTotals(lines);
    const groupSum = round2(t.perRate.reduce((s, g) => s + g.vat, 0));
    expect(groupSum).toBe(t.vatAmount);
    expect(t.total).toBe(round2(t.subtotal + t.vatAmount));
  });
});

describe('round2', () => {
  it('rondt half omhoog zonder float-artefact', () => {
    expect(round2(2.0979)).toBe(2.1);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(6.2937)).toBe(6.29);
  });
});
