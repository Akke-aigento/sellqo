// DASH-2a/2b — omzet voor het cockpit-dashboard: orders + kassa. Eén bron voor kanalen,
// vandaag per uur, records en drukte, zodat elk getal uit dezelfde verkoopregels komt.
// Twee ophalingen om de DB te sparen: het recente deel (vanaf de 1e van vorige maand, dekt
// ook de 4 weken van de drukte) ververst elke minuut; de oudere geschiedenis (records en
// reeksen tot 12 maanden terug) maar om het half uur. Geen realtime.
import { useMemo } from 'react';
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

interface Rows {
  orders: CockpitOrderRow[];
  pos: CockpitPosRow[];
}

async function fetchRows(tenantId: string, fromIso: string, toIso: string | null): Promise<Rows> {
  const [orders, pos] = await Promise.all([
    fetchAllRows<CockpitOrderRow>((from, to) => {
      let q = supabase
        .from('orders')
        .select('id, created_at, total, status, payment_status, marketplace_source, sales_channel')
        .eq('tenant_id', tenantId)
        .gte('created_at', fromIso);
      if (toIso) q = q.lt('created_at', toIso);
      return q.order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, to);
    }),
    fetchAllRows<CockpitPosRow>((from, to) => {
      let q = supabase
        .from('pos_transactions')
        .select('id, created_at, total, status, order_id')
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('created_at', fromIso);
      if (toIso) q = q.lt('created_at', toIso);
      return q.order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, to);
    }),
  ]);
  return { orders, pos };
}

export function useCockpitRevenue(enabled: boolean) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  // Grens tussen recent en geschiedenis: de 1e van vorige maand (lokaal), vast per maand.
  const boundary = cockpitPeriods(new Date()).prevMonthStart.toISOString();

  const recent = useQuery({
    queryKey: ['cockpit-revenue', tenantId, boundary],
    enabled: enabled && !!tenantId,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: () => fetchRows(tenantId!, boundary, null),
  });

  const history = useQuery({
    queryKey: ['cockpit-revenue-history', tenantId, boundary],
    enabled: enabled && !!tenantId,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: () => {
      const yearAgo = subDays(new Date(), COCKPIT_HISTORY_DAYS);
      return yearAgo.toISOString() < boundary
        ? fetchRows(tenantId!, yearAgo.toISOString(), boundary)
        : Promise.resolve<Rows>({ orders: [], pos: [] });
    },
  });

  const data = useMemo(() => {
    if (!recent.data) return undefined;
    const now = new Date();
    const revenue = aggregateCockpitRevenue(recent.data.orders, recent.data.pos, now);
    const recentSales = toSales(recent.data.orders, recent.data.pos);
    // Records en reeksen pas met de geschiedenis erbij; tot dan enkel het recente deel.
    const allSales = history.data ? [...toSales(history.data.orders, history.data.pos), ...recentSales] : recentSales;
    const yearAgo = subDays(now, COCKPIT_HISTORY_DAYS);
    return {
      ...revenue,
      hourly: hourlyCompare(recentSales, now),
      streak: salesStreak(allSales, now),
      records: cockpitRecords(allSales, now, revenue.todayRevenue),
      rush: rushForecast(recentSales, now),
      /** True als de geschiedenis de hele looptijd van de winkel dekt ("ooit" i.p.v. "in 12 maanden"). */
      fullHistory: !!currentTenant?.created_at && new Date(currentTenant.created_at) >= yearAgo,
    };
  }, [recent.data, history.data, currentTenant?.created_at]);

  return { data, isLoading: recent.isLoading, isError: recent.isError };
}

export type CockpitRevenueData = NonNullable<ReturnType<typeof useCockpitRevenue>['data']>;
