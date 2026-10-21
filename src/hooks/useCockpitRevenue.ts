// DASH-2a — omzet voor het cockpit-dashboard: orders + kassa, vanaf de 1e van vorige maand.
// Geen realtime: react-query ververst bij terugkeer naar het venster.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { fetchAllRows } from '@/lib/salesStats';
import {
  aggregateCockpitRevenue,
  cockpitPeriods,
  type CockpitOrderRow,
  type CockpitPosRow,
} from '@/lib/cockpitRevenue';

export function useCockpitRevenue(enabled: boolean) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['cockpit-revenue', tenantId],
    enabled: enabled && !!tenantId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const now = new Date();
      // Lokale maandgrens → ISO pas bij de query.
      const since = cockpitPeriods(now).prevMonthStart.toISOString();

      const [orders, pos] = await Promise.all([
        fetchAllRows<CockpitOrderRow>((from, to) =>
          supabase
            .from('orders')
            .select('id, created_at, total, status, payment_status, marketplace_source, sales_channel')
            .eq('tenant_id', tenantId!)
            .gte('created_at', since)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
        fetchAllRows<CockpitPosRow>((from, to) =>
          supabase
            .from('pos_transactions')
            .select('id, created_at, total, status, order_id')
            .eq('tenant_id', tenantId!)
            .eq('status', 'completed')
            .gte('created_at', since)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
      ]);

      return aggregateCockpitRevenue(orders, pos, now);
    },
  });
}
