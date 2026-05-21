import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export type VatReportPeriodType = 'monthly' | 'quarterly' | 'annual' | 'custom';

export interface VatReportDateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export interface VatReportOptions {
  periodType?: VatReportPeriodType;
  includeDrafts?: boolean;
  includeAuditTrail?: boolean;
  forceRecompute?: boolean;
  enabled?: boolean;
}

// Loose payload typing — full shape mirrors VatReportPayload in the edge fn.
export interface VatReportPayload {
  metadata: {
    tenant: { id: string; name: string | null; vat_number: string | null; kbo: string | null };
    period: { start: string; end: string; type: VatReportPeriodType };
    generated_at: string;
    invoice_count: number;
    credit_note_count: number;
    currency: 'EUR';
    from_cache?: boolean;
    duration_ms?: number;
  };
  declaration_boxes: Record<string, { amount: number; vat: number; source_invoice_count: number; source_line_count: number }>;
  oss_by_country: Array<{ country_code: string; base_amount: number; vat_rate: number; vat_amount: number; invoice_count: number }>;
  ic_listing: Array<{ vat_number: string; country_code: string; company_name: string; amount: number; type_code: 'L' | 'T' | 'S'; invoice_ids: string[] }>;
  client_listing: Array<{ vat_number: string; company_name: string; turnover_excl_vat: number; total_vat: number; invoice_count: number }>;
  by_rate: Array<{ rate: number; regime: string; base_amount: number; vat_amount: number; invoice_count: number }>;
  by_country: Array<{ country_code: string; regime: string; base_amount: number; vat_amount: number; invoice_count: number }>;
  stripe_reconciliation: Record<string, unknown> | null;
  audit_trail: Array<{ invoice_id: string; invoice_number: string; issue_date: string; customer: string; vat_regime: string; declaration_box: string; base_amount: number; vat_amount: number; is_credit_note: boolean }>;
  warnings: string[];
}

export function useVatReport(range: VatReportDateRange, options: VatReportOptions = {}) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const periodType = options.periodType ?? 'custom';

  return useQuery({
    queryKey: ['vat-report', tenantId, range.start, range.end, periodType, options.includeDrafts ?? false],
    enabled: !!tenantId && !!range.start && !!range.end && (options.enabled ?? true),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<VatReportPayload> => {
      const { data, error } = await supabase.functions.invoke('vat-report-engine', {
        body: {
          tenant_id: tenantId,
          period_start: range.start,
          period_end: range.end,
          period_type: periodType,
          include_drafts: options.includeDrafts ?? false,
          include_audit_trail: options.includeAuditTrail ?? true,
          force_recompute: options.forceRecompute ?? false,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'vat-report-engine failed');
      return data.payload as VatReportPayload;
    },
  });
}