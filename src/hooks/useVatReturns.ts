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

export function useCalculateVatReturn() {
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async ({ 
      periodType, 
      year, 
      period 
    }: { 
      periodType: VatReturnPeriodType; 
      year: number; 
      period: number;
    }): Promise<VatReturnCalculation> => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const { startDate, endDate } = getPeriodDates(periodType, year, period);

      // Get invoices
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          lines:invoice_lines(*),
          customer:customers(billing_country, vat_number)
        `)
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .in('status', ['sent', 'paid']);

      if (invoicesError) throw invoicesError;

      // Get credit notes
      const { data: creditNotes, error: cnError } = await supabase
        .from('credit_notes')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .gte('issue_date', startDate)
        .lte('issue_date', endDate)
        .in('status', ['sent', 'processed']);

      if (cnError) throw cnError;

      // Calculate totals
      const vatByRate = new Map<number, { taxableAmount: number; vatAmount: number }>();
      let intraCommunitySupplies = 0;
      let exports = 0;

      const tenantCountry = currentTenant.country || 'BE';
      const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

      for (const invoice of invoices || []) {
        const customerCountry = invoice.customer?.billing_country;
        const hasVatNumber = !!invoice.customer?.vat_number;

        // Check if IC or export
        if (customerCountry && customerCountry !== tenantCountry) {
          if (euCountries.includes(customerCountry) && hasVatNumber) {
            intraCommunitySupplies += invoice.subtotal;
            continue;
          } else if (!euCountries.includes(customerCountry)) {
            exports += invoice.subtotal;
            continue;
          }
        }

        // Domestic sales - group by VAT rate
        for (const line of invoice.lines || []) {
          const rate = Number(line.vat_rate) || 0;
          const existing = vatByRate.get(rate) || { taxableAmount: 0, vatAmount: 0 };
          existing.taxableAmount += Number(line.line_total) - Number(line.vat_amount);
          existing.vatAmount += Number(line.vat_amount);
          vatByRate.set(rate, existing);
        }
      }

      // Subtract credit notes
      for (const cn of creditNotes || []) {
        // Simplified: subtract from domestic for now
        const rate21 = vatByRate.get(21) || { taxableAmount: 0, vatAmount: 0 };
        rate21.taxableAmount -= Number(cn.subtotal);
        rate21.vatAmount -= Number(cn.tax_amount);
        vatByRate.set(21, rate21);
      }

      const byRate = Array.from(vatByRate.entries()).map(([rate, data]) => ({
        rate,
        taxableAmount: data.taxableAmount,
        vatAmount: data.vatAmount,
      }));

      const domesticTaxable = byRate.reduce((sum, r) => sum + r.taxableAmount, 0);
      const domesticVat = byRate.reduce((sum, r) => sum + r.vatAmount, 0);

      return {
        domesticSales: {
          taxableAmount: domesticTaxable,
          vatAmount: domesticVat,
          byRate,
        },
        intraCommunitySupplies,
        exports,
        vatDue: domesticVat,
        invoiceCount: invoices?.length || 0,
        creditNoteCount: creditNotes?.length || 0,
      };
    },
  });
}

export function useGenerateICListing() {
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async ({ year, quarter }: { year: number; quarter: number }): Promise<ICListingEntry[]> => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const { startDate, endDate } = getPeriodDates('quarterly', year, quarter);

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          subtotal,
          customer:customers(vat_number, billing_country)
        `)
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .in('status', ['sent', 'paid'])
        .eq('is_b2b', true);

      if (error) throw error;

      const tenantCountry = currentTenant.country || 'BE';
      const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

      const grouped = new Map<string, number>();

      for (const invoice of invoices || []) {
        const vatNumber = invoice.customer?.vat_number;
        const country = invoice.customer?.billing_country;

        if (vatNumber && country && country !== tenantCountry && euCountries.includes(country)) {
          const current = grouped.get(vatNumber) || 0;
          grouped.set(vatNumber, current + Number(invoice.subtotal));
        }
      }

      return Array.from(grouped.entries()).map(([vatNumber, amount]) => ({
        customerVatNumber: vatNumber.slice(2),
        countryCode: vatNumber.slice(0, 2),
        amount,
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
