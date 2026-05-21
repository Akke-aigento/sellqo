// Shared types for the vat-report-engine.
// Mirrors src/types/accounting.ts (Deno cannot import from src/).

export type VatRegimeCode =
  | 'domestic_standard'
  | 'domestic_reduced_6'
  | 'domestic_reduced_12'
  | 'domestic_zero'
  | 'ic_supply_goods'
  | 'ic_supply_services'
  | 'ic_supply_triangulation'
  | 'ic_triangulation'
  | 'export_outside_eu'
  | 'oss_b2c_eu'
  | 'reverse_charge_construction'
  | 'marketplace_deemed_supplier'
  | 'exempt_article_44';

export type PeriodType = 'monthly' | 'quarterly' | 'annual' | 'custom';

export interface VatReportRequest {
  tenant_id: string;
  period_start: string; // ISO date
  period_end: string;   // ISO date
  period_type: PeriodType;
  include_drafts?: boolean;
  include_audit_trail?: boolean;
  force_recompute?: boolean;
}

export interface BoxData {
  amount: number;
  vat: number;
  source_invoice_count: number;
  source_line_count: number;
}

export type DeclarationBoxCode =
  | '00' | '01' | '02' | '03'
  | '44' | '45' | '46' | '47' | '48' | '49'
  | '54' | '55' | '56' | '57' | '59'
  | '61' | '62' | '63' | '64'
  | '71' | '72'
  | '81' | '82' | '83' | '84' | '85' | '86' | '87' | '88';

export type DeclarationBoxes = Record<DeclarationBoxCode, BoxData>;

export interface OssCountryEntry {
  country_code: string;
  base_amount: number;
  vat_rate: number;
  vat_amount: number;
  invoice_count: number;
}

export interface IcListingEntry {
  vat_number: string;
  country_code: string;
  company_name: string;
  amount: number;
  type_code: 'L' | 'T' | 'S';
  invoice_ids: string[];
}

export interface ClientListingEntry {
  vat_number: string;
  company_name: string;
  turnover_excl_vat: number;
  total_vat: number;
  invoice_count: number;
}

export interface ByRateEntry {
  rate: number;
  regime: VatRegimeCode | string;
  base_amount: number;
  vat_amount: number;
  invoice_count: number;
}

export interface ByCountryEntry {
  country_code: string;
  regime: VatRegimeCode | string;
  base_amount: number;
  vat_amount: number;
  invoice_count: number;
}

export interface AuditTrailEntry {
  invoice_id: string;
  invoice_number: string;
  issue_date: string;
  customer: string;
  vat_regime: string;
  declaration_box: string;
  base_amount: number;
  vat_amount: number;
  is_credit_note: boolean;
}

export interface StripeReconciliation {
  period_payouts_eur: number;
  expected_payouts_based_on_invoices: number;
  stripe_fees: number;
  refunds: number;
  fx_differences: number;
  discrepancy: number;
  status: string;
}

export interface VatReportPayload {
  metadata: {
    tenant: { id: string; name: string | null; vat_number: string | null; kbo: string | null };
    period: { start: string; end: string; type: PeriodType };
    generated_at: string;
    invoice_count: number;
    credit_note_count: number;
    currency: 'EUR';
    from_cache?: boolean;
    duration_ms?: number;
  };
  declaration_boxes: DeclarationBoxes;
  oss_by_country: OssCountryEntry[];
  ic_listing: IcListingEntry[];
  client_listing: ClientListingEntry[];
  by_rate: ByRateEntry[];
  by_country: ByCountryEntry[];
  stripe_reconciliation: StripeReconciliation | null;
  audit_trail: AuditTrailEntry[];
  warnings: string[];
}

// DB shapes (loose — we use service role client without generated types).
export interface DbCustomer {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  customer_type: string | null;
  vat_number: string | null;
  billing_country: string | null;
}

export interface DbInvoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  status: string;
  subtotal: number;
  tax_amount: number | null;
  total: number;
  issue_date: string;
  customer_id: string | null;
  vat_regime: string | null;
  reporting_country: string | null;
  vat_number_validated_at: string | null;
  vat_number_validated_value: string | null;
  customers?: DbCustomer | null;
}

export interface DbInvoiceLine {
  id: string;
  invoice_id: string;
  line_type: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  line_total: number;
  vat_box_code: string | null;
  gl_account_code: string | null;
  sort_order: number | null;
}

export interface DbCreditNote {
  id: string;
  tenant_id: string;
  credit_note_number: string;
  original_invoice_id: string;
  customer_id: string | null;
  subtotal: number;
  tax_amount: number | null;
  total: number;
  issue_date: string;
  status: string | null;
  customers?: DbCustomer | null;
}

export interface DbCreditNoteLine {
  id: string;
  credit_note_id: string;
  line_type: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  line_total: number;
}