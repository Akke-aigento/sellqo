// EVENT-FLOW-2 — tickettypes van een reeks eventdatums in één query, gegroepeerd per datum,
// voor de verkoopbaarheidsbadge (zie src/lib/eventReadiness.ts).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import type { ReadinessTicketType } from '@/lib/eventReadiness';

export function useEventTicketTypesByEvent(eventIds: string[]) {
  const { currentTenant } = useTenant();
  const ids = [...eventIds].sort();
  return useQuery({
    queryKey: ['event-readiness-ticket-types', currentTenant?.id, ids.join(',')],
    queryFn: async () => {
      const byEvent: Record<string, ReadinessTicketType[]> = {};
      if (!currentTenant || ids.length === 0) return byEvent;
      const { data, error } = await supabase
        .from('event_ticket_types')
        .select('event_detail_id, is_active, sales_start, sales_end')
        .eq('tenant_id', currentTenant.id)
        .in('event_detail_id', ids);
      if (error) throw error;
      for (const row of data ?? []) {
        const key = row.event_detail_id as string | null;
        if (!key) continue;
        (byEvent[key] ??= []).push({
          is_active: Boolean(row.is_active),
          sales_start: (row.sales_start as string | null) ?? null,
          sales_end: (row.sales_end as string | null) ?? null,
        });
      }
      return byEvent;
    },
    enabled: !!currentTenant && ids.length > 0,
  });
}
