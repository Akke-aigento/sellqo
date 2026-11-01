// PERSONEEL-2 — urenoverzicht (kassa_hours_report) en correcties (kassa_shift_correct).
// Enkel de zaakvoerder (tenant_admin); de functies controleren dat zelf.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import type { HoursReport } from '@/lib/kassaHours';

export type ShiftCorrection =
  | { action: 'adjust'; shift_id: string; clock_in_at: string; clock_out_at: string; reason: string }
  | { action: 'void'; shift_id: string; reason: string }
  | { action: 'add'; staff_id: string; clock_in_at: string; clock_out_at: string; reason: string };

export function useKassaHours(from: Date, to: Date, enabled = true) {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  const tenantId = currentTenant?.id;
  const key = ['kassa-hours', tenantId, from.toISOString(), to.toISOString()];

  const report = useQuery({
    queryKey: key,
    enabled: enabled && !!tenantId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('kassa_hours_report' as never, {
        p_tenant_id: tenantId, p_from: from.toISOString(), p_to: to.toISOString(),
      } as never);
      if (error) throw error;
      return data as unknown as HoursReport;
    },
  });

  const correct = useMutation({
    mutationFn: async (c: ShiftCorrection) => {
      const { data, error } = await supabase.rpc('kassa_shift_correct' as never, { p_tenant_id: tenantId, p: c } as never);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kassa-hours', tenantId] }),
  });

  return { report, correct };
}
