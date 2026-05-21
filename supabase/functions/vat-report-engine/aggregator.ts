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

  // 1) VIES enforcement
  const enforced = applyViesEnforcement(input.invoices);
  warnings.push(...enforced.warnings);
  const invoices = enforced.invoices;

  // 2) Allocate per-rate base buckets so vak 54 is computed via per-rate rounding.
  const ratesBase = { 6: 0, 12: 0, 21: 0 } as Record<number, number>;
  const boxes = emptyBoxes();
  const boxInvoiceIds: Record<DeclarationBoxCode, Set<string>> = {} as Record<DeclarationBoxCode, Set<string>>;
  for (const k of Object.keys(boxes) as DeclarationBoxCode[]) boxInvoiceIds[k] = new Set();

  const byRateMap = new Map<string, ByRateEntry & { invoiceIds: Set<string> }>();
  const byCountryMap = new Map<string, ByCountryEntry & { invoiceIds: Set<string> }>();

  // 3) Walk invoice lines (excluding OSS — handled separately).
  for (const inv of invoices) {
    const regime = inv.vat_regime || 'domestic_standard';
    const country = (inv.customers?.billing_country || inv.reporting_country || '').toUpperCase() || '??';
    const lines = input.linesByInvoice.get(inv.id) || [];

    for (const line of lines) {
      const rate = Number(line.vat_rate || 0);
      const base = Number(line.line_total || 0) - Number(line.vat_amount || 0);
      const vat = Number(line.vat_amount || 0);

      // by_rate + by_country regardless of regime (incl. OSS — useful for cross-check)
      const brKey = `${rate}::${regime}`;
      const br = byRateMap.get(brKey) || { rate, regime, base_amount: 0, vat_amount: 0, invoice_count: 0, invoiceIds: new Set<string>() };
      br.base_amount += base; br.vat_amount += vat; br.invoiceIds.add(inv.id);
      byRateMap.set(brKey, br);

      const bcKey = `${country}::${regime}`;
      const bc = byCountryMap.get(bcKey) || { country_code: country, regime, base_amount: 0, vat_amount: 0, invoice_count: 0, invoiceIds: new Set<string>() };
      bc.base_amount += base; bc.vat_amount += vat; bc.invoiceIds.add(inv.id);
      byCountryMap.set(bcKey, bc);

      // Box mapping (skip OSS / exempt)
      const mapping = mapRegimeToBoxes(regime, rate);
      if (mapping.base_box) {
        boxes[mapping.base_box].amount += base;
        boxes[mapping.base_box].source_line_count += 1;
        boxInvoiceIds[mapping.base_box].add(inv.id);
      }
      // For domestic regimes we accumulate base per rate (to compute vak 54 cleanly).
      if (regime === 'domestic_standard') ratesBase[21] = (ratesBase[21] || 0) + base;
      else if (regime === 'domestic_reduced_6') ratesBase[6] = (ratesBase[6] || 0) + base;
      else if (regime === 'domestic_reduced_12') ratesBase[12] = (ratesBase[12] || 0) + base;
    }
  }

  // 4) Walk credit notes — negative compensation in vak 48/49 (+ 64 for VAT).
  const creditRatesBase = { 6: 0, 12: 0, 21: 0 } as Record<number, number>;
  for (const cn of input.creditNotes) {
    // Recover the regime of the underlying invoice (look up by original_invoice_id).
    const orig = invoices.find((i) => i.id === cn.original_invoice_id);
    const regime = orig?.vat_regime || 'domestic_standard';
    const country = (cn.customers?.billing_country || '').toUpperCase() || '??';
    const lines = input.cnLinesByNote.get(cn.id) || [];
    for (const line of lines) {
      const rate = Number(line.vat_rate || 0);
      const base = Number(line.line_total || 0) - Number(line.vat_amount || 0);
      const vat = Number(line.vat_amount || 0);
      const mapping = mapRegimeToBoxes(regime, rate);
      if (mapping.credit_base_box) {
        boxes[mapping.credit_base_box].amount += base;
        boxes[mapping.credit_base_box].source_line_count += 1;
        boxInvoiceIds[mapping.credit_base_box].add(cn.id);
      }
      if (mapping.credit_vat_box) {
        if (rate === 6) creditRatesBase[6] = (creditRatesBase[6] || 0) + base;
        else if (rate === 12) creditRatesBase[12] = (creditRatesBase[12] || 0) + base;
        else if (rate === 21) creditRatesBase[21] = (creditRatesBase[21] || 0) + base;
        // count credit-note presence on vak 64 below
        boxInvoiceIds['64'].add(cn.id);
      }
      // by_rate / by_country also track credit notes (negative)
      const brKey = `${rate}::cn:${regime}`;
      const br = byRateMap.get(brKey) || { rate, regime: `${regime} (credit)`, base_amount: 0, vat_amount: 0, invoice_count: 0, invoiceIds: new Set<string>() };
      br.base_amount -= base; br.vat_amount -= vat; br.invoiceIds.add(cn.id);
      byRateMap.set(brKey, br);
    }
  }

  // 5) Per-rate VAT for vak 54 (output side) — applied to net per-rate sums.
  const vat54 = round2((ratesBase[6] || 0) * 0.06 + (ratesBase[12] || 0) * 0.12 + (ratesBase[21] || 0) * 0.21);
  boxes['54'].amount = vat54;
  boxes['54'].vat = vat54;
  // Track invoice-count contributors to 54 = union of 01/02/03 contributors
  for (const c of boxInvoiceIds['01']) boxInvoiceIds['54'].add(c);
  for (const c of boxInvoiceIds['02']) boxInvoiceIds['54'].add(c);
  for (const c of boxInvoiceIds['03']) boxInvoiceIds['54'].add(c);

  // Vak 64 (correction VAT on credit notes) — per-rate.
  const vat64 = round2((creditRatesBase[6] || 0) * 0.06 + (creditRatesBase[12] || 0) * 0.12 + (creditRatesBase[21] || 0) * 0.21);
  boxes['64'].amount = vat64;
  boxes['64'].vat = vat64;

  // 6) Purchase-side vakken (55/56/57/59/61/62/81-88) — placeholders (Fase 3).
  // 7) Vak 63 = 54 + 55 + 56 + 57 - 59 + 61 - 62 - 64
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
      audit_trail.push({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        issue_date: inv.issue_date,
        customer: customerName(inv.customers),
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
      audit_trail.push({
        invoice_id: cn.id,
        invoice_number: cn.credit_note_number,
        issue_date: cn.issue_date,
        customer: customerName(cn.customers),
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
  };

  return payload;
}