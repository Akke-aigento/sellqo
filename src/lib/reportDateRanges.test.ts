import { describe, it, expect } from 'vitest';
import { getReportPresetRange, REPORT_PRESET_KEYS } from './reportDateRanges';

// Lokale tijd, net als de app: new Date(jaar, maandIndex, dag, ...).
const local = (y: number, m: number, d: number, h = 0, mi = 0, s = 0, ms = 0) =>
  new Date(y, m - 1, d, h, mi, s, ms);

describe('getReportPresetRange', () => {
  const now = local(2026, 10, 21, 14, 30);

  it('deze maand = 1 t/m laatste dag van de huidige maand (niet het kwartaal)', () => {
    const r = getReportPresetRange('this_month', now);
    expect(r.from).toEqual(local(2026, 10, 1));
    expect(r.to).toEqual(local(2026, 10, 31, 23, 59, 59, 999));
    expect(r.type).toBe('monthly');
  });

  it('deze maand in februari van een schrikkeljaar eindigt op de 29e', () => {
    const r = getReportPresetRange('this_month', local(2028, 2, 10));
    expect(r.from).toEqual(local(2028, 2, 1));
    expect(r.to).toEqual(local(2028, 2, 29, 23, 59, 59, 999));
  });

  it('deze maand op de laatste milliseconde van de maand blijft in die maand', () => {
    const r = getReportPresetRange('this_month', local(2026, 10, 31, 23, 59, 59, 999));
    expect(r.from).toEqual(local(2026, 10, 1));
    expect(r.to).toEqual(local(2026, 10, 31, 23, 59, 59, 999));
  });

  it('vorige maand = volledige september', () => {
    const r = getReportPresetRange('last_month', now);
    expect(r.from).toEqual(local(2026, 9, 1));
    expect(r.to).toEqual(local(2026, 9, 30, 23, 59, 59, 999));
  });

  it('vorige maand in januari = december van het vorige jaar', () => {
    const r = getReportPresetRange('last_month', local(2026, 1, 15));
    expect(r.from).toEqual(local(2025, 12, 1));
    expect(r.to).toEqual(local(2025, 12, 31, 23, 59, 59, 999));
  });

  it('vorige maand op 31 maart = volledige februari (geen overloop)', () => {
    const r = getReportPresetRange('last_month', local(2026, 3, 31));
    expect(r.from).toEqual(local(2026, 2, 1));
    expect(r.to).toEqual(local(2026, 2, 28, 23, 59, 59, 999));
  });

  it('dit kwartaal = 1 okt t/m 31 dec', () => {
    const r = getReportPresetRange('this_quarter', now);
    expect(r.from).toEqual(local(2026, 10, 1));
    expect(r.to).toEqual(local(2026, 12, 31, 23, 59, 59, 999));
    expect(r.type).toBe('quarterly');
  });

  it('vorig kwartaal = 1 jul t/m 30 sep', () => {
    const r = getReportPresetRange('last_quarter', now);
    expect(r.from).toEqual(local(2026, 7, 1));
    expect(r.to).toEqual(local(2026, 9, 30, 23, 59, 59, 999));
  });

  it('vorig kwartaal in Q1 = Q4 van het vorige jaar', () => {
    const r = getReportPresetRange('last_quarter', local(2026, 2, 3));
    expect(r.from).toEqual(local(2025, 10, 1));
    expect(r.to).toEqual(local(2025, 12, 31, 23, 59, 59, 999));
  });

  it('dit jaar en vorig jaar', () => {
    expect(getReportPresetRange('this_year', now)).toEqual({
      from: local(2026, 1, 1),
      to: local(2026, 12, 31, 23, 59, 59, 999),
      type: 'annual',
    });
    expect(getReportPresetRange('last_year', now)).toEqual({
      from: local(2025, 1, 1),
      to: local(2025, 12, 31, 23, 59, 59, 999),
      type: 'annual',
    });
  });

  it('elke preset bevat `now` behalve de "vorige"-presets', () => {
    for (const key of REPORT_PRESET_KEYS) {
      const r = getReportPresetRange(key, now);
      const contains = r.from <= now && now <= r.to;
      expect(contains).toBe(!key.startsWith('last_'));
    }
  });
});
