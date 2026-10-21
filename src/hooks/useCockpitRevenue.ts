// DASH-2a/2b — omzet voor het cockpit-dashboard: orders + kassa van de laatste 12 maanden.
// Eén ophaling voedt alles wat op omzet rust (kanalen, vandaag per uur, records, drukte),
// zodat elk getal uit dezelfde bron komt. Geen realtime: react-query ververst elke minuut
// en bij terugkeer naar het venster.
import { useQuery } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { fetchAllRows } from '@/lib/salesStats';
import {
  aggregateCockpitRevenue,
  cockpitPeriods,
  toSales,
  type CockpitOrderRow,
  type CockpitPosRow,
} from '@/lib/cockpitRevenue';
import { cockpitRecords, hourlyCompare, rushForecast, salesStreak } from '@/lib/cockpitInsights';

/** Hoe ver terug de records kijken. */
export const COCKPIT_HISTORY_DAYS = 365;

export function useCockpitRevenue(enabled: boolean) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['cockpit-revenue', tenantId],
    enabled: enabled && !!tenantId,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const now = new Date();
      // Lokale grenzen → ISO pas bij de query. Altijd minstens tot de 1e van vorige maand.
      const prevMonthStart = cockpitPeriods(now).prevMonthStart;
      const yearAgo = subDays(now, COCKPIT_HISTORY_DAYS);
      const since = (yearAgo < prevMonthStart ? yearAgo : prevMonthStart).toISOString();

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

      const revenue = aggregateCockpitRevenue(orders, pos, now);
      const sales = toSales(orders, pos);
      return {
        ...revenue,
        hourly: hourlyCompare(sales, now),
        streak: salesStreak(sales, now),
        records: cockpitRecords(sales, now, revenue.todayRevenue),
        rush: rushForecast(sales, now),
        /** True als de geschiedenis de hele looptijd van de winkel dekt ("ooit" i.p.v. "in 12 maanden"). */
        fullHistory: !!currentTenant?.created_at && new Date(currentTenant.created_at) >= new Date(since),
      };
    },
  });
}

export type CockpitRevenueData = NonNullable<ReturnType<typeof useCockpitRevenue>['data']>;
