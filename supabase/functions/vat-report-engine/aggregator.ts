// Core aggregation: walks invoices + invoice_lines + credit_notes and produces
// the VatReportPayload. Pure-data helpers only; the entry point handles DB IO.

import { emptyBoxes, mapRegimeToBoxes } from './box-mapping.ts';
import { buildOssByCountry } from './oss-calculator.ts';
import { buildIcListing } from './ic-listing.ts';
import type {
  AuditTrailEntry,
  ByCountryEntry,
  ByRateEntry,
  ClientListingEntry,
  DbCreditNote,
  DbCreditNoteLine,
  DbInvoice,
  DbInvoiceLine,
  DeclarationBoxCode,
  DeclarationBoxes,
  PeriodType,
  VatReportPayload,
} from './types.ts';

const IC_REGIMES = new Set([
  'ic_supply_goods',
  'ic_supply_services',
  'ic_supply_triangulation',
  'ic_triangulation',
]);

function round2(n: number): number { return Math.round(n * 100) / 100; }

function customerName(c: DbInvoice['customers'] | undefined | null): string {
  if (!c) return '';
  if (c.company_name) return c.company_name;
  const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  return name || c.email || '';
}

/**
 * Resolve a display name for the audit trail. Many imported (e.g. bol.com)
 * invoices have no linked customer row — the actual buyer name lives on the
 * order. Falls back through: company → first+last → orders.customer_name →
 * email → orders.customer_email → '—'.
 */
function auditCustomer(
  c: DbInvoice['customers'] | undefined | null,
  order?: {
    customer_company_name?: string | null;
    customer_name?: string | null;
    customer_email?: string | null;
  } | null,
): string {
  const fromCustomer = customerName(c);
  if (fromCustomer) return fromCustomer;
  const orderCompany = (order?.customer_company_name || '').trim();
  if (orderCompany) return orderCompany;
  const orderName = (order?.customer_name || '').trim();
  if (orderName) return orderName;
  const orderEmail = (order?.customer_email || '').trim();
  if (orderEmail) return orderEmail;
  return '—';
}

/**
 * Apply VIES enforcement: invoices marked as ic_* without a validated VAT
 * snapshot get reclassified to domestic_standard for reporting purposes.
 * Mutates inv.vat_regime in-place on a shallow-cloned array.
 */
export function applyViesEnforcement(invoices: DbInvoice[]): { invoices: DbInvoice[]; warnings: string[] } {
  const warnings: string[] = [];
  const out = invoices.map((inv) => {
    if (inv.vat_regime && IC_REGIMES.has(inv.vat_regime) && !inv.vat_number_validated_at) {
      warnings.push(`Invoice ${inv.invoice_number} mist VIES-snapshot — gerapporteerd als binnenland`);
      return { ...inv, vat_regime: 'domestic_standard' };
    }
    return inv;
  });
  return { invoices: out, warnings };
}

export interface AggregateInput {
  tenantMeta: { id: string; name: string | null; vat_number: string | null; kbo: string | null };
  period: { start: string; end: string; type: PeriodType };
  invoices: DbInvoice[];
  linesByInvoice: Map<string, DbInvoiceLine[]>;
  creditNotes: DbCreditNote[];
  cnLinesByNote: Map<string, DbCreditNoteLine[]>;
  includeAuditTrail: boolean;
  stripeAccountId: string | null;
}

export function aggregate(input: AggregateInput): VatReportPayload {
  const warnings: string[] = [];
  const data_quality_issues: { invoice_number: string; line_vat: number; header_vat: number; delta: number }[] = [];

  // 1) VIES enforcement
  const enforced = applyViesEnforcement(input.invoices);
  warnings.push(...enforced.warnings);
  const invoices = enforced.invoices;

  // 2) Setup box accumulators (header-driven: subtotal => base box, tax_amount => vat box).
  const boxes = emptyBoxes();
  const boxInvoiceIds: Record<DeclarationBoxCode, Set<string>> = {} as Record<DeclarationBoxCode, Set<string>>;
  for (const k of Object.keys(boxes) as DeclarationBoxCode[]) boxInvoiceIds[k] = new Set();

  const byRateMap = new Map<string, ByRateEntry & { invoiceIds: Set<string> }>();
  const byCountryMap = new Map<string, ByCountryEntry & { invoiceIds: Set<string> }>();

  // 3) Walk INVOICE HEADERS — primary source for base + vat amounts.
  //    by_rate breakdown still aggregates from lines, but with per-invoice
  //    sanity-check fallback to header when lines don't reconcile.
  let unknownCountryCount = 0;
  for (const inv of invoices) {
    const regime = inv.vat_regime || 'domestic_standard';
    const rawCountry = (inv.customers?.billing_country || inv.reporting_country || '').toUpperCase();
    const country = rawCountry || '__UNKNOWN__';
    if (!rawCountry) unknownCountryCount += 1;

    const headerBase = Number(inv.subtotal || 0);
    const headerVat = Number(inv.tax_amount || 0);

    // Pick representative VAT rate for box mapping (regime drives box; rate only
    // matters for unknown-regime fallback in mapRegimeToBoxes).
    const lines = input.linesByInvoice.get(inv.id) || [];
    const repRate = lines.find((l) => Number(l.vat_rate) > 0)?.vat_rate
      ?? (headerBase > 0 ? Math.round((headerVat / headerBase) * 100) : 0);

    const mapping = mapRegimeToBoxes(regime, Number(repRate));
    if (mapping.base_box) {
      boxes[mapping.base_box].amount += headerBase;
      boxes[mapping.base_box].source_line_count += lines.length;
      boxInvoiceIds[mapping.base_box].add(inv.id);
    }
    if (mapping.vat_box) {
      boxes[mapping.vat_box].vat += headerVat;
      boxInvoiceIds[mapping.vat_box].add(inv.id);
    }

    // by_country (header-driven)
    const bcKey = `${country}::${regime}`;
    const bc = byCountryMap.get(bcKey) || { country_code: country, regime, base_amount: 0, vat_amount: 0, invoice_count: 0, invoiceIds: new Set<string>() };
    bc.base_amount += headerBase;
    bc.vat_amount += headerVat;
    bc.invoiceIds.add(inv.id);
    byCountryMap.set(bcKey, bc);

    // by_rate breakdown — aggregate per-rate from lines, with sanity check.
    const lineVatSum = lines.reduce((s, l) => s + Number(l.vat_amount || 0), 0);
    const useHeaderFallback = Math.abs(lineVatSum - headerVat) > 1;
    if (useHeaderFallback) {
      data_quality_issues.push({
        invoice_number: inv.invoice_number,
        line_vat: round2(lineVatSum),
        header_vat: round2(headerVat),
        delta: round2(lineVatSum - headerVat),
      });
      // Bucket whole invoice under representative rate as a single by_rate entry.
      const rate = Number(repRate) || 0;
      const brKey = `${rate}::${regime}`;
      const br = byRateMap.get(brKey) || { rate, regime, base_amount: 0, vat_amount: 0, invoice_count: 0, invoiceIds: new Set<string>() };
      br.base_amount += headerBase;
      br.vat_amount += headerVat;
      br.invoiceIds.add(inv.id);
      byRateMap.set(brKey, br);
    } else {
      for (const line of lines) {
        const rate = Number(line.vat_rate || 0);
        const base = Number(line.line_total || 0) - Number(line.vat_amount || 0);
        const vat = Number(line.vat_amount || 0);
        const brKey = `${rate}::${regime}`;
        const br = byRateMap.get(brKey) || { rate, regime, base_amount: 0, vat_amount: 0, invoice_count: 0, invoiceIds: new Set<string>() };
        br.base_amount += base; br.vat_amount += vat; br.invoiceIds.add(inv.id);
        byRateMap.set(brKey, br);
      }
    }
  }

  if (unknownCountryCount > 0) {
    warnings.push(`${unknownCountryCount} invoice(s) zonder land-code — gegroepeerd onder "__UNKNOWN__"`);
  }

  if (data_quality_issues.length > 0) {
    warnings.push(
      `${data_quality_issues.length} invoices hebben line/header VAT-mismatch — bron is Shopify-import, header gebruikt voor totals. Zie data_quality_issues array voor details.`,
    );
  }

  // 4) Walk credit notes (header-driven, negative compensation in 48/49 + 64).
  for (const cn of input.creditNotes) {
    const orig = invoices.find((i) => i.id === cn.original_invoice_id);
    const regime = orig?.vat_regime || 'domestic_standard';
    const headerBase = Number(cn.subtotal || 0);
    const headerVat = Number(cn.tax_amount || 0);
    const lines = input.cnLinesByNote.get(cn.id) || [];
    const repRate = lines.find((l) => Number(l.vat_rate) > 0)?.vat_rate
      ?? (headerBase > 0 ? Math.round((headerVat / headerBase) * 100) : 0);
    const mapping = mapRegimeToBoxes(regime, Number(repRate));
    if (mapping.credit_base_box) {
      boxes[mapping.credit_base_box].amount += headerBase;
      boxes[mapping.credit_base_box].source_line_count += lines.length;
      boxInvoiceIds[mapping.credit_base_box].add(cn.id);
    }
    if (mapping.credit_vat_box) {
      boxes[mapping.credit_vat_box].vat += headerVat;
      boxInvoiceIds[mapping.credit_vat_box].add(cn.id);
    }
  }

  // 5) Purchase-side vakken (55/56/57/59/61/62/81-88) — placeholders (Fase 3).
  // 6) Vak 63 = 54 + 55 + 56 + 57 - 59 + 61 - 62 - 64 (all header-derived)
  const v63 =
    boxes['54'].vat + boxes['55'].vat + boxes['56'].vat + boxes['57'].vat -
    boxes['59'].vat + boxes['61'].vat - boxes['62'].vat - boxes['64'].vat;
  boxes['63'].amount = round2(v63);
  boxes['63'].vat = round2(v63);
  boxes['71'].amount = round2(Math.max(v63, 0));
  boxes['71'].vat = boxes['71'].amount;
  boxes['72'].amount = round2(Math.max(-v63, 0));
  boxes['72'].vat = boxes['72'].amount;

  // Round all amounts, finalize source_invoice_count.
  for (const code of Object.keys(boxes) as DeclarationBoxCode[]) {
    boxes[code].amount = round2(boxes[code].amount);
    boxes[code].vat = round2(boxes[code].vat);
    boxes[code].source_invoice_count = boxInvoiceIds[code].size;
  }

  // Round-trip integrity check
  const expected63 = boxes['54'].vat + boxes['55'].vat + boxes['56'].vat + boxes['57'].vat
    - boxes['59'].vat + boxes['61'].vat - boxes['62'].vat - boxes['64'].vat;
  if (Math.abs(expected63 - boxes['63'].vat) > 0.02) {
    warnings.push(`Round-trip integrity issue: expected ${round2(expected63)}, got ${boxes['63'].vat}`);
  }

  // 8) OSS by country
  const oss_by_country = buildOssByCountry(invoices, input.linesByInvoice);

  // 9) IC listing
  const ic = buildIcListing(invoices);
  // (excluded already counted above as VIES warnings via applyViesEnforcement;
  //  but ic also drops invoices it cannot match — surface as warnings too.)
  for (const num of ic.excludedInvoiceNumbers) {
    warnings.push(`IC-listing skipped invoice ${num} — geen geldig VIES-snapshot of BTW-nummer`);
  }

  // 10) Client listing — only on annual
  let client_listing: ClientListingEntry[] = [];
  if (input.period.type === 'annual') {
    const map = new Map<string, ClientListingEntry & { invoiceIds: Set<string> }>();
    for (const inv of invoices) {
      const c = inv.customers;
      if (!c || c.customer_type !== 'b2b') continue;
      if ((c.billing_country || '').toUpperCase() !== 'BE') continue;
      if (!c.vat_number) continue;
      const turnover = Number(inv.subtotal || 0);
      const vatAmt = Number(inv.tax_amount || 0);
      const key = c.vat_number.trim().toUpperCase();
      const cur = map.get(key) || {
        vat_number: key,
        company_name: c.company_name || customerName(c),
        turnover_excl_vat: 0,
        total_vat: 0,
        invoice_count: 0,
        invoiceIds: new Set<string>(),
      };
      cur.turnover_excl_vat += turnover;
      cur.total_vat += vatAmt;
      cur.invoiceIds.add(inv.id);
      map.set(key, cur);
    }
    client_listing = Array.from(map.values())
      .filter((c) => c.turnover_excl_vat >= 250)
      .map((c) => ({
        vat_number: c.vat_number,
        company_name: c.company_name,
        turnover_excl_vat: round2(c.turnover_excl_vat),
        total_vat: round2(c.total_vat),
        invoice_count: c.invoiceIds.size,
      }))
      .sort((a, b) => a.vat_number.localeCompare(b.vat_number));
  }

  // 11) by_rate + by_country finalize
  const by_rate: ByRateEntry[] = Array.from(byRateMap.values())
    .map((g) => ({
      rate: g.rate,
      regime: g.regime,
      base_amount: round2(g.base_amount),
      vat_amount: round2(g.vat_amount),
      invoice_count: g.invoiceIds.size,
    }))
    .sort((a, b) => a.rate - b.rate || String(a.regime).localeCompare(String(b.regime)));

  const by_country: ByCountryEntry[] = Array.from(byCountryMap.values())
    .map((g) => ({
      country_code: g.country_code,
      regime: g.regime,
      base_amount: round2(g.base_amount),
      vat_amount: round2(g.vat_amount),
      invoice_count: g.invoiceIds.size,
    }))
    .sort((a, b) => a.country_code.localeCompare(b.country_code) || String(a.regime).localeCompare(String(b.regime)));

  // 12) Audit trail
  let audit_trail: AuditTrailEntry[] = [];
  if (input.includeAuditTrail) {
    for (const inv of invoices) {
      const regime = inv.vat_regime || 'domestic_standard';
      const mapping = mapRegimeToBoxes(regime, 0);
      const invOrder = inv.orders;
      audit_trail.push({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        issue_date: inv.issue_date,
        customer: auditCustomer(inv.customers, invOrder),
        vat_regime: regime,
        declaration_box: mapping.base_box || (regime === 'oss_b2c_eu' ? 'OSS' : '—'),
        base_amount: round2(Number(inv.subtotal || 0)),
        vat_amount: round2(Number(inv.tax_amount || 0)),
        is_credit_note: false,
      });
    }
    for (const cn of input.creditNotes) {
      const orig = invoices.find((i) => i.id === cn.original_invoice_id);
      const regime = orig?.vat_regime || 'domestic_standard';
      const mapping = mapRegimeToBoxes(regime, 0);
      const origOrder = orig?.orders ?? null;
      audit_trail.push({
        invoice_id: cn.id,
        invoice_number: cn.credit_note_number,
        issue_date: cn.issue_date,
        customer: auditCustomer(cn.customers, origOrder),
        vat_regime: regime,
        declaration_box: mapping.credit_base_box || '—',
        base_amount: -round2(Number(cn.subtotal || 0)),
        vat_amount: -round2(Number(cn.tax_amount || 0)),
        is_credit_note: true,
      });
    }
    audit_trail.sort((a, b) => a.issue_date.localeCompare(b.issue_date));
  }

  // 13) Stripe reconciliation placeholder
  const stripe_reconciliation = input.stripeAccountId
    ? {
        period_payouts_eur: 0,
        expected_payouts_based_on_invoices: 0,
        stripe_fees: 0,
        refunds: 0,
        fx_differences: 0,
        discrepancy: 0,
        status: 'not_implemented',
      }
    : null;

  const payload: VatReportPayload = {
    metadata: {
      tenant: input.tenantMeta,
      period: input.period,
      generated_at: new Date().toISOString(),
      invoice_count: invoices.length,
      credit_note_count: input.creditNotes.length,
      currency: 'EUR',
    },
    declaration_boxes: boxes as DeclarationBoxes,
    oss_by_country,
    ic_listing: ic.entries,
    client_listing,
    by_rate,
    by_country,
    stripe_reconciliation,
    audit_trail,
    warnings,
    data_quality_issues,
  };

  return payload;
}