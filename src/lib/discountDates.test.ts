import { describe, expect, it } from 'vitest';
import { isoToLocalDate, localDayEndIso, localDayStartIso } from './discountDates';

describe('discountDates (Europe/Brussels)', () => {
  it('zomertijd: einde/begin van de lokale dag', () => {
    expect(localDayEndIso('2026-10-24')).toBe('2026-10-24T21:59:59.999Z');
    expect(localDayStartIso('2026-10-24')).toBe('2026-10-23T22:00:00.000Z');
  });

  it('omschakeldag 25-10-2026: dag begint in CEST en eindigt in CET (25 uur)', () => {
    const start = localDayStartIso('2026-10-25');
    const end = localDayEndIso('2026-10-25');
    expect(start).toBe('2026-10-24T22:00:00.000Z');
    expect(end).toBe('2026-10-25T22:59:59.999Z');
    expect(Date.parse(end!) + 1 - Date.parse(start!)).toBe(25 * 3600 * 1000);
  });

  it('wintertijd na de omschakeling', () => {
    expect(localDayEndIso('2026-10-26')).toBe('2026-10-26T22:59:59.999Z');
    expect(localDayStartIso('2026-10-26')).toBe('2026-10-25T23:00:00.000Z');
  });

  it('lente-omschakeling 29-03-2026 (23 uur)', () => {
    const start = localDayStartIso('2026-03-29');
    const end = localDayEndIso('2026-03-29');
    expect(start).toBe('2026-03-28T23:00:00.000Z');
    expect(end).toBe('2026-03-29T21:59:59.999Z');
    expect(Date.parse(end!) + 1 - Date.parse(start!)).toBe(23 * 3600 * 1000);
  });

  it('einde van de dag valt nog op die dag, 1 ms later is het de volgende dag', () => {
    for (const d of ['2026-10-24', '2026-10-25', '2026-10-26', '2026-12-31']) {
      const end = localDayEndIso(d)!;
      expect(isoToLocalDate(end)).toBe(d);
      expect(isoToLocalDate(new Date(Date.parse(end) + 1).toISOString())).not.toBe(d);
      expect(isoToLocalDate(localDayStartIso(d))).toBe(d);
    }
  });

  it('oude waarden (middernacht UTC) tonen dezelfde kalenderdag', () => {
    expect(isoToLocalDate('2026-10-31T00:00:00.000Z')).toBe('2026-10-31');
    expect(isoToLocalDate('2026-07-15T00:00:00+00:00')).toBe('2026-07-15');
  });

  it('ongeldige of lege invoer', () => {
    expect(localDayEndIso('')).toBeNull();
    expect(localDayStartIso('31-10-2026')).toBeNull();
    expect(isoToLocalDate(null)).toBeNull();
    expect(isoToLocalDate('geen datum')).toBeNull();
  });
});
