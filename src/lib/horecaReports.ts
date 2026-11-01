// RAPPORT-HORECA-1 — Rapporten › Horeca: Z-archief als CSV voor de boekhouder en de analyse
// (horeca_analysis). Puur, getest in horecaReports.test.ts. De Z-cijfers komen ongewijzigd uit
// kassa_reports.data (zelfde bron als het Z-rapport in de kassa).
import type { ReportResult } from '@/kassa/app/reportActions';

export interface HorecaAnalysis {
  from: string; to: string; from_day: string; to_day: string;
  totals: {
    revenue_cents: number; tickets: number; checks: number; checks_revenue_cents: number;
    guests: number; guests_revenue_cents: number; tips_cents: number;
  };
  products: { key: string; name: string; qty: number; cents: number }[];
  hours: { hour: number; count: number; cents: number }[];
  days: { day: string; count: number; cents: number }[];
  staff: { staff_id: string | null; name: string | null; count: number; cents: number; tips_cents: number }[];
}

/** Gemiddelde in centen, of null als er niets te delen valt. */
export function avg(cents: number, n: number): number | null {
  return n > 0 ? Math.round(cents / n) : null;
}

/** 24 uren (0–23), ontbrekende uren als 0. */
export function fullHours(a: HorecaAnalysis): { hour: number; count: number; cents: number }[] {
  const m = new Map(a.hours.map((h) => [h.hour, h]));
  return Array.from({ length: 24 }, (_, hour) => m.get(hour) ?? { hour, count: 0, cents: 0 });
}

/** Enkel de uren tussen het eerste en laatste uur met verkoop (om een lege grafiek te vermijden). */
export function activeHours(a: HorecaAnalysis) {
  const all = fullHours(a);
  const used = all.filter((h) => h.count > 0).map((h) => h.hour);
  if (!used.length) return [];
  return all.slice(Math.min(...used), Math.max(...used) + 1);
}

/** Centen → "12,34" (boekhoudnotatie, zonder valutateken). */
export const csvEuro = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

/** Alle btw-tarieven en betaalwijzen die in de rapporten voorkomen, vaste volgorde. */
export function zColumns(reports: ReportResult[]): { rates: number[]; methods: string[]; tipMethods: string[] } {
  const rates = new Set<number>(); const methods = new Set<string>(); const tipMethods = new Set<string>();
  for (const r of reports) {
    for (const v of r.data.vats ?? []) rates.add(Number(v.rate));
    for (const p of r.data.payments ?? []) methods.add(p.method);
    for (const p of r.data.tips ?? []) tipMethods.add(p.method);
  }
  return { rates: [...rates].sort((a, b) => b - a), methods: [...methods].sort(), tipMethods: [...tipMethods].sort() };
}

export interface ZCsvLabels {
  no: string; day: string; from: string; to: string; count: string; total: string; net: string; vat: string;
  netRate: (rate: number) => string; vatRate: (rate: number) => string; method: (m: string) => string; tip: (m: string) => string;
  rounding: string; discounts: string; cashIn: string; cashOut: string; voided: string; corrections: string;
}

/** Eén rij per Z, oudste eerst; per btw-tarief maatstaf en btw, per betaalwijze het bedrag. */
export function zCsv(reports: ReportResult[], L: ZCsvLabels, time: (iso: string) => string): { headers: string[]; rows: (string | number)[][] } {
  const z = reports.filter((r) => r.kind === 'Z').sort((a, b) => (a.report_no ?? 0) - (b.report_no ?? 0));
  const { rates, methods, tipMethods } = zColumns(z);
  const headers = [L.no, L.day, L.from, L.to, L.count, L.total, L.net, L.vat,
    ...rates.flatMap((r) => [L.netRate(r), L.vatRate(r)]), ...methods.map(L.method), L.rounding, ...tipMethods.map(L.tip),
    L.discounts, L.cashIn, L.cashOut, L.voided, L.corrections];
  const rows = z.map((r) => {
    const d = r.data;
    const vat = new Map((d.vats ?? []).map((v) => [Number(v.rate), v]));
    const pay = new Map((d.payments ?? []).map((p) => [p.method, p.cents]));
    const tip = new Map((d.tips ?? []).map((p) => [p.method, p.cents]));
    return [r.report_no ?? '', r.booking_date, time(r.period_start), time(r.period_end), d.sales.count,
      csvEuro(d.sales.total_cents), csvEuro(d.sales.net_cents), csvEuro(d.sales.vat_cents),
      ...rates.flatMap((rt) => [csvEuro(vat.get(rt)?.net_cents ?? 0), csvEuro(vat.get(rt)?.vat_cents ?? 0)]),
      ...methods.map((m) => csvEuro(pay.get(m) ?? 0)), csvEuro(d.rounding_cents ?? 0), ...tipMethods.map((m) => csvEuro(tip.get(m) ?? 0)),
      csvEuro(d.sales.discount_cents ?? 0), csvEuro(d.cash?.in_cents ?? 0), csvEuro(d.cash?.out_cents ?? 0),
      csvEuro(d.voided?.total_cents ?? 0), csvEuro(d.corrections?.total_cents ?? 0)];
  });
  return { headers, rows };
}
