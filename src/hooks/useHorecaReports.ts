// RAPPORT-HORECA-1 — Z-archief (kassa_reports, via RLS) en analyse (RPC horeca_analysis) voor
// Rapporten › Horeca. Periode = bedrijfsdagen (yyyy-MM-dd, inclusief), zoals de Z-rapporten.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import type { ReportResult } from '@/kassa/app/reportActions';
import type { HorecaAnalysis } from '@/lib/horecaReports';

export function useZArchive(fromDay: string, toDay: string, enabled = true) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['horeca-z-archive', tenantId, fromDay, toDay],
    enabled: enabled && !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('kassa_reports' as never)
        .select('id, kind, report_no, booking_date, period_start, period_end, data')
        .eq('tenant_id' as never, tenantId as never)
        .eq('kind' as never, 'Z' as never)
        .gte('booking_date' as never, fromDay as never)
        .lte('booking_date' as never, toDay as never)
        .order('report_no' as never, { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as ReportResult[];
    },
  });
}

export function useHorecaAnalysis(fromDay: string, toDay: string, enabled = true) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['horeca-analysis', tenantId, fromDay, toDay],
    enabled: enabled && !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('horeca_analysis' as never, { p_tenant_id: tenantId, p_from_day: fromDay, p_to_day: toDay } as never);
      if (error) throw error;
      return data as unknown as HorecaAnalysis;
    },
  });
}
