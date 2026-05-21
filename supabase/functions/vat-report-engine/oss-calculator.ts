// Aggregates OSS B2C cross-border turnover per destination country.

import type { DbInvoice, DbInvoiceLine, OssCountryEntry } from './types.ts';

export function buildOssByCountry(
  invoices: DbInvoice[],
  linesByInvoice: Map<string, DbInvoiceLine[]>,
): OssCountryEntry[] {
  // Group by (country, vat_rate) — different rates per destination must be split.
  const map = new Map<string, { country: string; rate: number; base: number; vat: number; invoiceIds: Set<string> }>();

  for (const inv of invoices) {
    if (inv.vat_regime !== 'oss_b2c_eu') continue;
    const country = (inv.reporting_country || inv.customers?.billing_country || '').toUpperCase();
    if (!country) continue;
    const lines = linesByInvoice.get(inv.id) || [];
    for (const line of lines) {
      const rate = Number(line.vat_rate || 0);
      const key = `${country}::${rate}`;
      const base = Number(line.line_total || 0) - Number(line.vat_amount || 0);
      const vat = Number(line.vat_amount || 0);
      const cur = map.get(key) || { country, rate, base: 0, vat: 0, invoiceIds: new Set<string>() };
      cur.base += base;
      cur.vat += vat;
      cur.invoiceIds.add(inv.id);
      map.set(key, cur);
    }
  }

  return Array.from(map.values())
    .map((g) => ({
      country_code: g.country,
      vat_rate: g.rate,
      base_amount: round2(g.base),
      vat_amount: round2(g.vat),
      invoice_count: g.invoiceIds.size,
    }))
    .sort((a, b) => a.country_code.localeCompare(b.country_code) || a.vat_rate - b.vat_rate);
}

function round2(n: number): number { return Math.round(n * 100) / 100; }