import { describe, expect, it } from 'vitest';
import { decimalHours, formatMinutes, hoursCsvRows, summarizeWeek, tipPot, weekDays, weekStart, type HoursReport, type HoursShift } from './kassaHours';

const staff = [
  { id: 'a', name: 'An', employee_no: 1, role: 'waiter', is_active: true },
  { id: 'b', name: 'Bart', employee_no: 2, role: 'bartender', is_active: true },
];
const shift = (p: Partial<HoursShift>): HoursShift => ({
  id: Math.random().toString(36), staff_id: 'a', source: 'kassa', clock_in_at: '2026-10-26T09:00:00Z', clock_out_at: '2026-10-26T17:00:00Z',
  original_in: null, original_out: null, voided: false, corrected: false, reason: null, corrected_at: null, business_day: '2026-10-26', ...p,
});
const report = (shifts: HoursShift[], tips: { day: string; cents: number }[] = []): HoursReport => ({ from: '', to: '', now: '', staff, shifts, tips });

describe('week', () => {
  it('maandag tot zondag', () => {
    const m = weekStart(new Date(2026, 9, 29, 15));
    expect(weekDays(m)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });
  it('uren per medewerker per dag; geschrapt telt niet; open apart; buiten de week niet', () => {
    const w = summarizeWeek(report([
      shift({}),
      shift({ staff_id: 'b', clock_in_at: '2026-10-27T18:00:00Z', clock_out_at: '2026-10-28T01:30:00Z', business_day: '2026-10-27' }),
      shift({ voided: true, business_day: '2026-10-28' }),
      shift({ clock_out_at: null, business_day: '2026-10-29' }),
      shift({ business_day: '2026-11-02' }),
    ]), weekStart(new Date(2026, 9, 29)));
    expect(w.rows.map((r) => [r.staff.name, r.total, r.perDay[0], r.perDay[1]])).toEqual([['An', 480, 480, 0], ['Bart', 450, 0, 450]]);
    expect(w.open).toHaveLength(1);
    expect(w.totalMinutes).toBe(930);
  });
  it('notatie', () => {
    expect(formatMinutes(450)).toBe('7:30');
    expect(formatMinutes(5)).toBe('0:05');
    expect(decimalHours(450)).toBe('7,50');
    expect(decimalHours(20)).toBe('0,33');
  });
});

describe('fooienpot', () => {
  it('verdeeld volgens uren, telt exact op', () => {
    const r = report([
      shift({ staff_id: 'a', clock_in_at: '2026-10-26T10:00:00Z', clock_out_at: '2026-10-26T12:00:00Z' }),
      shift({ staff_id: 'b', clock_in_at: '2026-10-26T10:00:00Z', clock_out_at: '2026-10-26T11:00:00Z' }),
    ], [{ day: '2026-10-26', cents: 1000 }]);
    const [d] = tipPot(r);
    expect(d.shares.map((s) => [s.staff.name, s.cents])).toEqual([['An', 667], ['Bart', 333]]);
    expect(d.shares.reduce((n, s) => n + s.cents, 0)).toBe(1000);
  });
  it('dag zonder uren: geen verdeling', () => {
    const [d] = tipPot(report([], [{ day: '2026-10-26', cents: 500 }]));
    expect(d.shares).toEqual([]);
  });
});

describe('csv', () => {
  it('shiftrijen en totaal per medewerker, zonder geschrapte', () => {
    const w = summarizeWeek(report([shift({}), shift({ voided: true })]), weekStart(new Date(2026, 9, 29)));
    const rows = hoursCsvRows(w, { headers: ['', '', '', '', '', '', '', '', '', ''], sourceKassa: 'kassa', sourceManual: 'man', yes: 'ja', no: 'nee', total: 'Totaal' }, (s) => s.slice(11, 16));
    expect(rows).toEqual([
      ['An', 1, '2026-10-26', '09:00', '17:00', 480, '8,00', 'kassa', 'nee', ''],
      ['An', 1, 'Totaal', '', '', 480, '8,00', '', '', ''],
    ]);
  });
});
