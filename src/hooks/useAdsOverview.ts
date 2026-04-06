import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { subDays, format } from 'date-fns';

export type AdsPeriod = 7 | 30 | 90;

export function useAdsOverview(period: AdsPeriod = 30) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const endDate = new Date();
  const startDate = subDays(endDate, period);
  const prevStartDate = subDays(startDate, period);
  const startStr = format(startDate, 'yyyy-MM-dd');
  const prevStartStr = format(prevStartDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');

  // Daily performance data
  const dailyQuery = useQuery({
    queryKey: ['ads-daily-performance', tenantId, period],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('ads_bolcom_performance')
        .select('date, impressions, clicks, spend, orders, revenue')
        .eq('tenant_id', tenantId)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Previous period for comparison
  const prevQuery = useQuery({
    queryKey: ['ads-prev-performance', tenantId, period],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('ads_bolcom_performance')
        .select('spend, revenue, clicks, impressions, orders')
        .eq('tenant_id', tenantId)
        .gte('date', prevStartStr)
        .lt('date', startStr);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // AI recommendations
  const recommendationsQuery = useQuery({
    queryKey: ['ads-ai-recommendations', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('ads_ai_recommendations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Inventory alerts - products below min stock for ads
  const inventoryAlertsQuery = useQuery({
    queryKey: ['ads-inventory-alerts', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('ads_product_channel_map')
        .select('id, channel, is_advertised, min_stock_for_ads, product_id, products(name, stock)')
        .eq('tenant_id', tenantId)
        .eq('is_advertised', true);
      if (error) throw error;
      // Filter client-side: stock < min_stock_for_ads
      return (data || []).filter((item: any) => {
        const stock = item.products?.stock ?? 0;
        return stock < (item.min_stock_for_ads ?? 1);
      });
    },
    enabled: !!tenantId,
  });

  // Bol.com connection status
  const bolConnectionQuery = useQuery({
    queryKey: ['ads-bol-connection', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('ad_platform_connections')
        .select('id, is_active, last_sync_at')
        .eq('tenant_id', tenantId)
        .eq('platform', 'bol_ads')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Aggregate current period
  const current = (dailyQuery.data || []).reduce(
    (acc, row) => ({
      spend: acc.spend + Number(row.spend || 0),
      revenue: acc.revenue + Number(row.revenue || 0),
      clicks: acc.clicks + Number(row.clicks || 0),
      impressions: acc.impressions + Number(row.impressions || 0),
      orders: acc.orders + Number(row.orders || 0),
    }),
    { spend: 0, revenue: 0, clicks: 0, impressions: 0, orders: 0 }
  );

  const prev = (prevQuery.data || []).reduce(
    (acc, row) => ({
      spend: acc.spend + Number(row.spend || 0),
      revenue: acc.revenue + Number(row.revenue || 0),
    }),
    { spend: 0, revenue: 0 }
  );

  const acos = current.revenue > 0 ? (current.spend / current.revenue) * 100 : 0;
  const roas = current.spend > 0 ? current.revenue / current.spend : 0;
  const prevAcos = prev.revenue > 0 ? (prev.spend / prev.revenue) * 100 : 0;
  const prevRoas = prev.spend > 0 ? prev.revenue / prev.spend : 0;

  const pctChange = (curr: number, previous: number) => {
    if (previous === 0) return curr > 0 ? 100 : 0;
    return ((curr - previous) / previous) * 100;
  };

  // Chart data: aggregate by date
  const chartData = (dailyQuery.data || []).reduce((acc: any[], row) => {
    const existing = acc.find(d => d.date === row.date);
    if (existing) {
      existing.spend += Number(row.spend || 0);
      existing.revenue += Number(row.revenue || 0);
    } else {
      acc.push({
        date: row.date,
        spend: Number(row.spend || 0),
        revenue: Number(row.revenue || 0),
      });
    }
    return acc;
  }, []);

  return {
    isLoading: dailyQuery.isLoading || prevQuery.isLoading,
    hasData: (dailyQuery.data || []).length > 0,
    kpis: {
      spend: current.spend,
      revenue: current.revenue,
      acos,
      roas,
      spendChange: pctChange(current.spend, prev.spend),
      revenueChange: pctChange(current.revenue, prev.revenue),
      acosChange: acos - prevAcos,
      roasChange: roas - prevRoas,
    },
    bolConnection: bolConnectionQuery.data,
    chartData,
    recommendations: recommendationsQuery.data || [],
    recommendationsCount: (recommendationsQuery.data || []).length,
    inventoryAlerts: inventoryAlertsQuery.data || [],
  };
}
