import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

export type VatReturnPeriodType = 'monthly' | 'quarterly';
export type VatReturnStatus = 'draft' | 'exported' | 'submitted';

export interface VatReturn {
  id: string;
  tenant_id: string;
  period_type: VatReturnPeriodType;
  year: number;
  period: number;
  domestic_taxable: number;
  domestic_vat: number;
  intra_community: number;
  exports: number;
  vat_due: number;
  invoice_count: number;
  credit_note_count: number;
  status: VatReturnStatus;
  exported_at: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface VatReturnCalculation {
  domesticSales: {
    taxableAmount: number;
    vatAmount: number;
    byRate: { rate: number; taxableAmount: number; vatAmount: number }[];
  };
  intraCommunitySupplies: number;
  exports: number;
  vatDue: number;
  invoiceCount: number;
  creditNoteCount: number;
}

export interface ICListingEntry {
  customerVatNumber: string;
  countryCode: string;
  amount: number;
}

function getPeriodDates(periodType: VatReturnPeriodType, year: number, period: number) {
  let startMonth: number;
  let endMonth: number;

  if (periodType === 'quarterly') {
    startMonth = (period - 1) * 3;
    endMonth = startMonth + 2;
  } else {
    startMonth = period - 1;
    endMonth = period - 1;
  }

  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, endMonth + 1, 0);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export function useVatReturns(year?: number) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['vat-returns', tenantId, year],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('vat_returns')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('year', { ascending: false })
        .order('period', { ascending: false });

      if (year) {
        query = query.eq('year', year);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as VatReturn[];
    },
    enabled: !!tenantId,
  });
}

/**
 * @deprecated Use `useVatReport` from '@/hooks/useVatReport' instead.
 * This hook is now a thin facade over the canonical vat-report-engine edge function.
 * Kept for backwards compatibility with legacy callers.
 */
export function useCalculateVatReturn() {
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async ({
      periodType,
      year,
      period,
    }: {
      periodType: VatReturnPeriodType;
      year: number;
      period: number;
    }): Promise<VatReturnCalculation> => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const { startDate, endDate } = getPeriodDates(periodType, year, period);

      const { data, error } = await supabase.functions.invoke('vat-report-engine', {
        body: {
          tenant_id: currentTenant.id,
          period_start: startDate,
          period_end: endDate,
          period_type: periodType,
          include_drafts: false,
          include_audit_trail: false,
          force_recompute: false,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'vat-report-engine failed');

      const payload = data.payload as {
        metadata: { invoice_count: number; credit_note_count: number };
        declaration_boxes: Record<string, { amount: number; vat: number }>;
        by_rate: Array<{ rate: number; base_amount: number; vat_amount: number }>;
      };

      const boxes = payload.declaration_boxes || {};
      const get = (code: string) => boxes[code] || { amount: 0, vat: 0 };

      // Domestic sales by rate — pulled from engine's by_rate breakdown.
      const byRate = (payload.by_rate || []).map(r => ({
        rate: r.rate,
        taxableAmount: r.base_amount,
        vatAmount: r.vat_amount,
      }));

      const domesticTaxable = get('03').amount + get('01').amount + get('02').amount;
      const domesticVat = get('54').vat;
      const intraCommunitySupplies = get('46').amount;
      const exportsAmount = get('47').amount;
      const vatDue = get('71').vat || domesticVat;

      return {
        domesticSales: {
          taxableAmount: domesticTaxable,
          vatAmount: domesticVat,
          byRate,
        },
        intraCommunitySupplies,
        exports: exportsAmount,
        vatDue,
        invoiceCount: payload.metadata.invoice_count,
        creditNoteCount: payload.metadata.credit_note_count,
      };
    },
  });
}

/**
 * @deprecated Use `useVatReport` and read `payload.ic_listing` instead.
 * Thin facade over the canonical vat-report-engine edge function.
 */
export function useGenerateICListing() {
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async ({ year, quarter }: { year: number; quarter: number }): Promise<ICListingEntry[]> => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const { startDate, endDate } = getPeriodDates('quarterly', year, quarter);

      const { data, error } = await supabase.functions.invoke('vat-report-engine', {
        body: {
          tenant_id: currentTenant.id,
          period_start: startDate,
          period_end: endDate,
          period_type: 'quarterly',
          include_drafts: false,
          include_audit_trail: false,
          force_recompute: false,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'vat-report-engine failed');

      const payload = data.payload as {
        ic_listing: Array<{ vat_number: string; country_code: string; amount: number }>;
      };

      return (payload.ic_listing || []).map(entry => ({
        customerVatNumber: entry.vat_number.startsWith(entry.country_code)
          ? entry.vat_number.slice(2)
          : entry.vat_number,
        countryCode: entry.country_code,
        amount: entry.amount,
      }));
    },
  });
}

export function useSaveVatReturn() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      periodType,
      year,
      period,
      calculation,
    }: {
      periodType: VatReturnPeriodType;
      year: number;
      period: number;
      calculation: VatReturnCalculation;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const { data, error } = await supabase
        .from('vat_returns')
        .upsert({
          tenant_id: currentTenant.id,
          period_type: periodType,
          year,
          period,
          domestic_taxable: calculation.domesticSales.taxableAmount,
          domestic_vat: calculation.domesticSales.vatAmount,
          intra_community: calculation.intraCommunitySupplies,
          exports: calculation.exports,
          vat_due: calculation.vatDue,
          invoice_count: calculation.invoiceCount,
          credit_note_count: calculation.creditNoteCount,
          status: 'exported',
          exported_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,period_type,year,period',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vat-returns'] });
      toast({ title: 'BTW-aangifte opgeslagen' });
    },
    onError: (error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });
}
