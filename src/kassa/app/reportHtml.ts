// TAFEL-3 — een X/Z-rapport als HTML om af te drukken of als PDF te bewaren (browser-print).
// De cijfers komen uit kassa_report_finish (SellQo). In een GKS-zaak drukt het scherm daarnaast
// het officiële rapport af uit de ondertekende events (print/buildReport).
// Nooit werknemersnummers: medewerkers staan met hun naam.
import type { ReportResult } from './reportActions';

export interface ReportLabels {
  title: string;
  shop: string;
  period: string;
  printedAt: string;
  sections: { sales: string; vats: string; payments: string; tips: string; cash: string; staff: string; shifts: string; other: string };
  row: Record<string, string>;
  method: (m: string) => string;
  euro: (cents: number) => string;
  date: (iso: string) => string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function reportHtml(r: ReportResult, L: ReportLabels): string {
  const d = r.data;
  const kv = (k: string, v: string, bold = false) => `<tr${bold ? ' class="b"' : ''}><td>${esc(k)}</td><td class="r">${esc(v)}</td></tr>`;
  const h = (s: string) => `<tr class="h"><td colspan="2">${esc(s)}</td></tr>`;
  const rows: string[] = [];
  rows.push(h(L.sections.sales));
  rows.push(kv(L.row.count, String(d.sales.count)));
  rows.push(kv(L.row.total, L.euro(d.sales.total_cents), true));
  rows.push(kv(L.row.net, L.euro(d.sales.net_cents)));
  rows.push(kv(L.row.vat, L.euro(d.sales.vat_cents)));
  if (d.sales.discount_cents) rows.push(kv(L.row.discounts, L.euro(d.sales.discount_cents)));
  if (d.vats.length) {
    rows.push(h(L.sections.vats));
    for (const v of d.vats) rows.push(kv(`${v.rate} % · ${L.row.netShort} ${L.euro(v.net_cents)}`, L.euro(v.vat_cents)));
  }
  if (d.payments.length) {
    rows.push(h(L.sections.payments));
    for (const p of d.payments) rows.push(kv(L.method(p.method), L.euro(p.cents)));
    if (d.rounding_cents) rows.push(kv(L.row.rounding, L.euro(d.rounding_cents)));
  }
  if (d.tips.length) {
    rows.push(h(L.sections.tips));
    for (const p of d.tips) rows.push(kv(L.method(p.method), L.euro(p.cents)));
  }
  rows.push(h(L.sections.cash));
  rows.push(kv(L.row.cashIn, L.euro(d.cash.in_cents)));
  rows.push(kv(L.row.cashOut, L.euro(d.cash.out_cents)));
  if (d.staff.length) {
    rows.push(h(L.sections.staff));
    for (const s of d.staff) rows.push(kv(`${s.name} (${s.count})`, L.euro(s.total_cents)));
  }
  if (d.shifts.length) {
    rows.push(h(L.sections.shifts));
    for (const s of d.shifts) {
      rows.push(kv(`${L.date(s.closed_at)} · ${L.row.expected}`, L.euro(s.expected_cents)));
      rows.push(kv(L.row.counted, L.euro(s.counted_cents)));
      rows.push(kv(L.row.difference, L.euro(s.difference_cents), true));
    }
  }
  rows.push(h(L.sections.other));
  rows.push(kv(L.row.voided, `${d.voided.count} · ${L.euro(d.voided.total_cents)}`));
  rows.push(kv(L.row.corrections, `${d.corrections.count} · ${L.euro(d.corrections.total_cents)}`));
  if (d.drawer_opens) rows.push(kv(L.row.drawerOpens, String(d.drawer_opens)));
  if (d.open_checks) rows.push(kv(L.row.openChecks, String(d.open_checks)));

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;margin:12px;color:#000;background:#fff}
h1{font-size:16px;margin:0 0 4px}p{margin:0 0 2px}table{width:100%;border-collapse:collapse;margin-top:8px}
td{padding:2px 0;vertical-align:top}.r{text-align:right;white-space:nowrap;padding-left:8px}.b td{font-weight:700}
.h td{font-weight:700;border-bottom:1px solid #000;padding-top:10px}@media print{body{margin:0}}</style></head><body>
<h1>${esc(L.title)}</h1><p>${esc(L.shop)}</p><p>${esc(L.period)}</p><p>${esc(L.printedAt)}</p>
<table>${rows.join('')}</table></body></html>`;
}
