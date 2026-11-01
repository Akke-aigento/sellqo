// KAART-MARGE-1 — foodcost = kostprijs / verkoopprijs excl. btw.
import { describe, expect, it } from 'vitest';
import { foodCostLabel, foodCostPct, isFoodCostHigh } from '../foodCost';

describe('foodcost', () => {
  it('rekent op de verkoopprijs excl. btw', () => {
    // 12,10 incl. 21 % = 10,00 excl.; kostprijs 3,00 → 30 %.
    expect(foodCostPct(12.1, 3, 21)).toBeCloseTo(30, 6);
    // 10,60 incl. 6 % = 10,00 excl.
    expect(foodCostPct(10.6, 4, 6)).toBeCloseTo(40, 6);
  });
  it('geen kostprijs of geen prijs: geen getal', () => {
    expect(foodCostPct(10, null, 21)).toBeNull();
    expect(foodCostPct(10, 0, 21)).toBeNull();
    expect(foodCostPct(0, 2, 21)).toBeNull();
  });
  it('kleurt boven 35 %', () => {
    expect(isFoodCostHigh(35)).toBe(false);
    expect(isFoodCostHigh(35.4)).toBe(true);
    expect(isFoodCostHigh(null)).toBe(false);
    expect(foodCostLabel(31.6)).toBe('32 %');
  });
});
