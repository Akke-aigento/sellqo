import { describe, it, expect } from 'vitest';
import { advanceDate, retreatDate } from '../../supabase/functions/_shared/billingDates.ts';

// BILLING-1: de datumhelper is de enige plek waar factuurperiodes verschuiven.
// Deze test staat bewust in src/, zodat tsconfig.app.json (include: ["src"])
// de helper mee typecheckt in CI.

describe('advanceDate — clamp en anchor', () => {
  it('houdt een 31e-abonnement een jaar lang op de bedoelde dag', () => {
    // Zonder clamp gaf setUTCMonth hier 2026-03-03; zonder anchor bleef het
    // abonnement na februari op de 28e hangen.
    const chain: string[] = [];
    let d = '2026-01-31';
    for (let i = 0; i < 5; i++) {
      d = advanceDate(d, 'monthly', 1, 31);
      chain.push(d);
    }
    expect(chain).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
      '2026-06-30',
    ]);
  });

  it('laat een 28e-abonnement onaangeroerd (geen regressie)', () => {
    expect(advanceDate('2026-01-28', 'monthly', 1, 28)).toBe('2026-02-28');
    expect(advanceDate('2026-02-28', 'monthly', 1, 28)).toBe('2026-03-28');
  });

  it('klemt 29 februari bij een jaarsprong naar een niet-schrikkeljaar', () => {
    expect(advanceDate('2028-02-29', 'yearly', 1, 29)).toBe('2029-02-28');
    // en herstelt in het volgende schrikkeljaar
    expect(advanceDate('2028-02-29', 'yearly', 4, 29)).toBe('2032-02-29');
  });

  it('gooit op een timestamp in plaats van stil NaN te produceren', () => {
    expect(() => advanceDate('2026-07-29T17:06:03Z', 'monthly')).toThrow(/pure datum/);
    expect(() => retreatDate('2026-07-29T17:06:03Z', 'monthly')).toThrow(/pure datum/);
    expect(() => advanceDate('', 'monthly')).toThrow();
    expect(() => advanceDate('29-07-2026', 'monthly')).toThrow();
  });
});

describe('advanceDate — intervallen', () => {
  it('rekent weekly in dagen', () => {
    expect(advanceDate('2026-01-31', 'weekly')).toBe('2026-02-07');
    expect(advanceDate('2026-01-01', 'weekly', 3)).toBe('2026-01-22');
  });

  it('rekent quarterly als drie maanden, met clamp', () => {
    expect(advanceDate('2026-01-31', 'quarterly')).toBe('2026-04-30');
    expect(advanceDate('2026-11-30', 'quarterly')).toBe('2027-02-28');
  });

  it('behandelt annual als yearly', () => {
    expect(advanceDate('2026-03-15', 'annual')).toBe('2027-03-15');
    expect(advanceDate('2026-03-15', 'yearly')).toBe('2027-03-15');
  });

  it('valt terug op monthly bij een onbekend of leeg interval', () => {
    expect(advanceDate('2026-01-15', 'fortnightly')).toBe('2026-02-15');
    expect(advanceDate('2026-01-15', '')).toBe('2026-02-15');
  });

  it('loopt correct over de jaargrens', () => {
    expect(advanceDate('2026-12-31', 'monthly')).toBe('2027-01-31');
    expect(advanceDate('2026-12-31', 'monthly', 14, 31)).toBe('2028-02-29');
  });

  it('negeert een anchor buiten 1-31 en gebruikt de dag van from', () => {
    expect(advanceDate('2026-01-15', 'monthly', 1, 0)).toBe('2026-02-15');
    expect(advanceDate('2026-01-15', 'monthly', 1, 99)).toBe('2026-02-15');
    expect(advanceDate('2026-01-15', 'monthly', 1, null)).toBe('2026-02-15');
  });
});

describe('retreatDate', () => {
  it('is het spiegelbeeld van advanceDate op veilige dagen', () => {
    expect(retreatDate('2026-03-15', 'monthly')).toBe('2026-02-15');
    expect(retreatDate('2026-01-15', 'monthly')).toBe('2025-12-15');
    expect(retreatDate('2027-03-15', 'yearly')).toBe('2026-03-15');
    expect(retreatDate('2026-02-07', 'weekly')).toBe('2026-01-31');
  });

  it('klemt ook terugwaarts', () => {
    expect(retreatDate('2026-03-31', 'monthly')).toBe('2026-02-28');
    expect(retreatDate('2026-03-31', 'quarterly')).toBe('2025-12-31');
  });
});
