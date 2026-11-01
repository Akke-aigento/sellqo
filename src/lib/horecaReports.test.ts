import { describe, expect, it } from 'vitest';
import type { ReportResult } from '@/kassa/app/reportActions';
import { activeHours, avg, csvEuro, zCsv, type HorecaAnalysis } from './horecaReports';

const z = (no: number, over: Partial<ReportResult['data']> = {}): ReportResult => ({
  id: `z${no}`, kind: 'Z', report_no: no, booking_date: `2026-10-0${no}`, period_start: '2026-10-01T04:00:00Z', period_end: '2026-10-02T04:00:00Z',
  data: {
    from: '', to: '', sales: { count: 3, total_cents: 12100, vat_cents: 2100, net_cents: 10000, discount_cents: 0 },
    vats: [{ rate: 21, gross_cents: 12100, vat_cents: 2100, net_cents: 10000 }], payments: [{ method: 'card', cents: 12100 }],
    rounding_cents: 0, tips: [], cash: { in_cents: 0, out_cents: 0, count: 0 }, voided: { count: 0, total_cents: 0 },
    corrections: { count: 0, total_cents: 0 }, staff: [], shifts: [], drawer_opens: 0, open_checks: 0, ...over,
  },
});

const L = {
  no: 'Nr', day: 'Dag', from: 'Van', to: 'Tot', count: 'Aantal', total: 'Totaal', net: 'Netto', vat: 'Btw',
  netRate: (r: number) => `Netto ${r}%`, vatRate: (r: number) => `Btw ${r}%`, method: (m: string) => m, tip: (m: string) => `Fooi ${m}`,
  rounding: 'Afronding', discounts: 'Kortingen', cashIn: 'In', cashOut: 'Uit', voided: 'Geannuleerd', corrections: 'Correcties',
};

describe('Z-csv', () => {
  it('kolommen per tarief en betaalwijze over alle rapporten, oudste eerst, X weg', () => {
    const x = { ...z(9), kind: 'X' as const, report_no: null };
    const two = z(2, { vats: [{ rate: 12, gross_cents: 1120, vat_cents: 120, net_cents: 1000 }], payments: [{ method: 'cash', cents: 1120 }], tips: [{ method: 'card', cents: 200 }] });
    const { headers, rows } = zCsv([two, x, z(1)], L, (s) => s.slice(0, 10));
    expect(headers).toEqual(['Nr', 'Dag', 'Van', 'Tot', 'Aantal', 'Totaal', 'Netto', 'Btw', 'Netto 21%', 'Btw 21%', 'Netto 12%', 'Btw 12%',
      'card', 'cash', 'Afronding', 'Fooi card', 'Kortingen', 'In', 'Uit', 'Geannuleerd', 'Correcties']);
    expect(rows.map((r) => r[0])).toEqual([1, 2]);
    expect(rows[0].slice(8, 14)).toEqual(['100,00', '21,00', '0,00', '0,00', '121,00', '0,00']);
    expect(rows[1][15]).toBe('2,00');
  });
  it('bedragen', () => {
    expect(csvEuro(-5)).toBe('-0,05');
    expect(avg(1000, 3)).toBe(333);
    expect(avg(1000, 0)).toBeNull();
  });
});

describe('uren', () => {
  it('enkel van eerste tot laatste uur met verkoop', () => {
    const a = { hours: [{ hour: 11, count: 1, cents: 100 }, { hour: 14, count: 2, cents: 300 }] } as HorecaAnalysis;
    expect(activeHours(a).map((h) => [h.hour, h.cents])).toEqual([[11, 100], [12, 0], [13, 0], [14, 300]]);
    expect(activeHours({ hours: [] } as unknown as HorecaAnalysis)).toEqual([]);
  });
});
