// PERSONEEL-2 — urenoverzicht van SellQo Kassa: pure rekenregels (getest in kassaHours.test.ts).
// Bron: RPC kassa_hours_report (shifts mét de laatste correctie, de medewerkers en de fooien per
// bedrijfsdag). Een shift hoort bij de bedrijfsdag van zijn begin (afkapuur van de zaak, zoals
// de Z-rapporten). Open shifts tellen niet mee in de uren; ze staan apart.
import { addDays, format, startOfISOWeek } from 'date-fns';

export interface HoursStaff { id: string; name: string; employee_no: number | null; role: string; is_active: boolean }
export interface HoursShift {
  id: string; staff_id: string; source: 'kassa' | 'manual';
  clock_in_at: string; clock_out_at: string | null;
  original_in: string | null; original_out: string | null;
  voided: boolean; corrected: boolean; reason: string | null; corrected_at: string | null;
  business_day: string;
}
export interface HoursReport { from: string; to: string; now: string; staff: HoursStaff[]; shifts: HoursShift[]; tips: { day: string; cents: number }[] }

/** Maandag (lokaal) van de week waarin `d` valt. */
export function weekStart(d: Date): Date { return startOfISOWeek(d); }

/** De zeven bedrijfsdagen (yyyy-MM-dd) van een week, maandag eerst. */
export function weekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'yyyy-MM-dd'));
}

/**
 * Bereik om op te vragen: de server filtert op het begin van de shift, de bedrijfsdag schuift met
 * de afkapuur. Eén dag marge aan beide kanten; daarna filteren op business_day.
 */
export function weekQueryRange(monday: Date): { from: Date; to: Date } {
  return { from: addDays(monday, -1), to: addDays(monday, 8) };
}

export function shiftMinutes(s: Pick<HoursShift, 'clock_in_at' | 'clock_out_at' | 'voided'>): number {
  if (s.voided || !s.clock_out_at) return 0;
  return Math.max(0, Math.round((new Date(s.clock_out_at).getTime() - new Date(s.clock_in_at).getTime()) / 60000));
}

export interface StaffWeek {
  staff: HoursStaff;
  /** Minuten per dag, zelfde volgorde als weekDays. */
  perDay: number[];
  total: number;
  shifts: HoursShift[];
}

export interface WeekSummary {
  days: string[];
  rows: StaffWeek[];
  /** Nog open shifts (ook van vóór deze week): niet in de uren. */
  open: HoursShift[];
  totalMinutes: number;
}

export function summarizeWeek(report: HoursReport, monday: Date): WeekSummary {
  const days = weekDays(monday);
  const idx = new Map(days.map((d, i) => [d, i]));
  const byStaff = new Map<string, StaffWeek>();
  const staffById = new Map(report.staff.map((s) => [s.id, s]));
  const row = (id: string) => {
    let r = byStaff.get(id);
    if (!r) {
      const staff = staffById.get(id) ?? { id, name: '—', employee_no: null, role: '', is_active: false };
      r = { staff, perDay: days.map(() => 0), total: 0, shifts: [] };
      byStaff.set(id, r);
    }
    return r;
  };
  const open: HoursShift[] = [];
  for (const s of report.shifts) {
    if (!s.clock_out_at && !s.voided) { open.push(s); continue; }
    const i = idx.get(s.business_day);
    if (i === undefined) continue;
    const r = row(s.staff_id);
    r.shifts.push(s);
    const m = shiftMinutes(s);
    r.perDay[i] += m;
    r.total += m;
  }
  const rows = [...byStaff.values()].sort((a, b) => a.staff.name.localeCompare(b.staff.name));
  return { days, rows, open, totalMinutes: rows.reduce((n, r) => n + r.total, 0) };
}

/** 450 → "7:30". */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  return `${h}:${String(min % 60).padStart(2, '0')}`;
}

/** 450 → "7,50" (decimale uren, Belgische notatie, voor het sociaal secretariaat). */
export function decimalHours(min: number): string {
  return (Math.round((min / 60) * 100) / 100).toFixed(2).replace('.', ',');
}

export interface TipShare { staff: HoursStaff; minutes: number; cents: number }
export interface TipDay { day: string; cents: number; minutes: number; shares: TipShare[] }

/**
 * Fooienpot per bedrijfsdag: de fooien van die dag verdeeld volgens de gewerkte minuten van die
 * dag (afgesloten, niet geschrapte shifts). Grootste-rest-methode, zodat de delen exact optellen
 * tot het totaal. Een dag met fooi maar zonder gewerkte uren krijgt geen verdeling.
 */
export function tipPot(report: HoursReport, days?: string[]): TipDay[] {
  const keep = days ? new Set(days) : null;
  const staffById = new Map(report.staff.map((s) => [s.id, s]));
  const out: TipDay[] = [];
  for (const t of report.tips) {
    if (keep && !keep.has(t.day)) continue;
    const mins = new Map<string, number>();
    for (const s of report.shifts) {
      if (s.business_day !== t.day) continue;
      const m = shiftMinutes(s);
      if (m > 0) mins.set(s.staff_id, (mins.get(s.staff_id) ?? 0) + m);
    }
    const total = [...mins.values()].reduce((a, b) => a + b, 0);
    const shares: TipShare[] = [];
    if (total > 0) {
      const raw = [...mins.entries()].map(([id, m]) => ({ id, m, exact: (t.cents * m) / total }));
      let given = 0;
      for (const r of raw) given += Math.floor(r.exact);
      const order = [...raw].sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)) || a.id.localeCompare(b.id));
      const extra = new Set(order.slice(0, t.cents - given).map((r) => r.id));
      for (const r of raw) {
        shares.push({
          staff: staffById.get(r.id) ?? { id: r.id, name: '—', employee_no: null, role: '', is_active: false },
          minutes: r.m,
          cents: Math.floor(r.exact) + (extra.has(r.id) ? 1 : 0),
        });
      }
      shares.sort((a, b) => b.cents - a.cents || a.staff.name.localeCompare(b.staff.name));
    }
    out.push({ day: t.day, cents: t.cents, minutes: total, shares });
  }
  return out;
}

export interface HoursCsvLabels {
  headers: [string, string, string, string, string, string, string, string, string, string];
  sourceKassa: string; sourceManual: string; yes: string; no: string; total: string;
}

/** CSV van één week: één rij per shift, daarna een totaal per medewerker. */
export function hoursCsvRows(week: WeekSummary, L: HoursCsvLabels, time: (iso: string) => string): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const r of week.rows) {
    for (const s of [...r.shifts].sort((a, b) => a.clock_in_at.localeCompare(b.clock_in_at))) {
      if (s.voided) continue;
      const m = shiftMinutes(s);
      rows.push([r.staff.name, r.staff.employee_no ?? '', s.business_day, time(s.clock_in_at), s.clock_out_at ? time(s.clock_out_at) : '',
        m, decimalHours(m), s.source === 'manual' ? L.sourceManual : L.sourceKassa, s.corrected ? L.yes : L.no, s.reason ?? '']);
    }
  }
  for (const r of week.rows) {
    rows.push([r.staff.name, r.staff.employee_no ?? '', L.total, '', '', r.total, decimalHours(r.total), '', '', '']);
  }
  return rows;
}
