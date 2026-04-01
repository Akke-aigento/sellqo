import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { subDays, format } from 'date-fns';

export type Period = '7d' | '30d' | '90d';

function getPeriodDays(period: Period): number {
  return period === '7d' ? 7 : period === '30d' ? 30 : 90;
}

export function useBolcomAds() {
  const { currentTenant } = useTenant();
  const [period, setPeriod] = useState<Period>('30d');
  const tenantId = currentTenant?.id;

  const days = getPeriodDays(period);
  const now = new Date();
  const currentStart = format(subDays(now, days), 'yyyy-MM-dd');
  const prevStart = format(subDays(now, days * 2), 'yyyy-MM-dd');
  const prevEnd = format(subDays(now, days + 1), 'yyyy-MM-dd');
  const todayStr = format(now, 'yyyy-MM-dd');

  // Performance KPIs (current + previous period)
  const { data: perfData, isLoading: perfLoading } = useQuery({
    queryKey: ['bolcom-performance', tenantId, period],
    enabled: !!tenantId,
    queryFn: async () => {
      const [{ data: current }, { data: previous }] = await Promise.all([
        supabase
          .from('ads_bolcom_performance')
          .select('spend, revenue, impressions, clicks, orders, acos, ctr, conversion_rate, date')
          .eq('tenant_id', tenantId!)
          .gte('date', currentStart)
          .lte('date', todayStr),
        supabase
          .from('ads_bolcom_performance')
          .select('spend, revenue, impressions, clicks, orders')
          .eq('tenant_id', tenantId!)
          .gte('date', prevStart)
          .lte('date', prevEnd),
      ]);
      return { current: current || [], previous: previous || [] };
    },
  });

  // Campaigns
  const { data: campaigns, isLoading: campLoading } = useQuery({
    queryKey: ['bolcom-campaigns', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ads_bolcom_campaigns')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('name');
      return data || [];
    },
  });

  // Campaign performance aggregated
  const { data: campPerf } = useQuery({
    queryKey: ['bolcom-campaign-perf', tenantId, period],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ads_bolcom_performance')
        .select('campaign_id, spend, impressions, clicks, orders, revenue, acos')
        .eq('tenant_id', tenantId!)
        .gte('date', currentStart)
        .lte('date', todayStr);
      return data || [];
    },
  });

  // Top keywords
  const { data: topKeywords, isLoading: kwLoading } = useQuery({
    queryKey: ['bolcom-top-keywords', tenantId, period],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: perfRows } = await supabase
        .from('ads_bolcom_performance')
        .select('keyword_id, clicks, spend, revenue, acos')
        .eq('tenant_id', tenantId!)
        .gte('date', currentStart)
        .lte('date', todayStr)
        .not('keyword_id', 'is', null);

      if (!perfRows?.length) return [];

      // Aggregate by keyword_id
      const agg = new Map<string, { clicks: number; spend: number; revenue: number }>();
      for (const r of perfRows) {
        if (!r.keyword_id) continue;
        const prev = agg.get(r.keyword_id) || { clicks: 0, spend: 0, revenue: 0 };
        agg.set(r.keyword_id, {
          clicks: prev.clicks + (r.clicks || 0),
          spend: prev.spend + (r.spend || 0),
          revenue: prev.revenue + (r.revenue || 0),
        });
      }

      const topIds = [...agg.entries()]
        .sort((a, b) => b[1].clicks - a[1].clicks)
        .slice(0, 10)
        .map(([id]) => id);

      const { data: keywords } = await supabase
        .from('ads_bolcom_keywords')
        .select('id, keyword, match_type, bid')
        .in('id', topIds);

      return (keywords || []).map(kw => {
        const stats = agg.get(kw.id) || { clicks: 0, spend: 0, revenue: 0 };
        const acos = stats.revenue > 0 ? (stats.spend / stats.revenue) * 100 : 0;
        return { ...kw, clicks: stats.clicks, acos: Math.round(acos * 100) / 100 };
      }).sort((a, b) => b.clicks - a.clicks);
    },
  });

  // Top search terms
  const { data: topSearchTerms, isLoading: stLoading } = useQuery({
    queryKey: ['bolcom-top-search-terms', tenantId, period],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ads_bolcom_search_terms')
        .select('search_term, clicks, spend, orders, revenue, date')
        .eq('tenant_id', tenantId!)
        .gte('date', currentStart)
        .lte('date', todayStr);

      if (!data?.length) return [];

      // Aggregate by search_term
      const agg = new Map<string, { clicks: number; spend: number; orders: number; revenue: number }>();
      for (const r of data) {
        const prev = agg.get(r.search_term) || { clicks: 0, spend: 0, orders: 0, revenue: 0 };
        agg.set(r.search_term, {
          clicks: prev.clicks + (r.clicks || 0),
          spend: prev.spend + (r.spend || 0),
          orders: prev.orders + (r.orders || 0),
          revenue: prev.revenue + (r.revenue || 0),
        });
      }

      return [...agg.entries()]
        .sort((a, b) => b[1].clicks - a[1].clicks)
        .slice(0, 10)
        .map(([term, stats]) => ({
          search_term: term,
          ...stats,
          acos: stats.revenue > 0 ? Math.round((stats.spend / stats.revenue) * 10000) / 100 : 0,
          isWaste: stats.spend > 5 && stats.orders === 0,
        }));
    },
  });

  // Computed KPIs
  const kpis = useMemo(() => {
    const cur = perfData?.current || [];
    const prev = perfData?.previous || [];

    const sum = (arr: any[], key: string) => arr.reduce((s, r) => s + (Number(r[key]) || 0), 0);

    const cSpend = sum(cur, 'spend');
    const cRevenue = sum(cur, 'revenue');
    const cImpressions = sum(cur, 'impressions');
    const cClicks = sum(cur, 'clicks');
    const cOrders = sum(cur, 'orders');

    const pSpend = sum(prev, 'spend');
    const pRevenue = sum(prev, 'revenue');
    const pImpressions = sum(prev, 'impressions');
    const pClicks = sum(prev, 'clicks');
    const pOrders = sum(prev, 'orders');

    const pct = (c: number, p: number) => p > 0 ? ((c - p) / p) * 100 : 0;

    const acos = cRevenue > 0 ? (cSpend / cRevenue) * 100 : 0;
    const pAcos = pRevenue > 0 ? (pSpend / pRevenue) * 100 : 0;
    const ctr = cImpressions > 0 ? (cClicks / cImpressions) * 100 : 0;
    const pCtr = pImpressions > 0 ? (pClicks / pImpressions) * 100 : 0;
    const convRate = cClicks > 0 ? (cOrders / cClicks) * 100 : 0;
    const pConvRate = pClicks > 0 ? (pOrders / pClicks) * 100 : 0;

    return {
      spend: cSpend,
      spendChange: pct(cSpend, pSpend),
      revenue: cRevenue,
      revenueChange: pct(cRevenue, pRevenue),
      acos,
      acosChange: pAcos > 0 ? acos - pAcos : 0,
      ctr,
      ctrChange: pCtr > 0 ? ctr - pCtr : 0,
      convRate,
      convRateChange: pConvRate > 0 ? convRate - pConvRate : 0,
    };
  }, [perfData]);

  // Chart data (daily)
  const chartData = useMemo(() => {
    const cur = perfData?.current || [];
    const byDate = new Map<string, { spend: number; revenue: number; acos: number; impressions: number }>();
    for (const r of cur) {
      const prev = byDate.get(r.date) || { spend: 0, revenue: 0, acos: 0, impressions: 0 };
      const spend = prev.spend + (Number(r.spend) || 0);
      const revenue = prev.revenue + (Number(r.revenue) || 0);
      byDate.set(r.date, {
        spend,
        revenue,
        acos: revenue > 0 ? (spend / revenue) * 100 : 0,
        impressions: prev.impressions + (Number(r.impressions) || 0),
      });
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  }, [perfData]);

  // Enrich campaigns with performance
  const enrichedCampaigns = useMemo(() => {
    if (!campaigns) return [];
    const perfBycamp = new Map<string, { spend: number; impressions: number; clicks: number; orders: number; revenue: number }>();
    for (const r of (campPerf || [])) {
      if (!r.campaign_id) continue;
      const prev = perfBycamp.get(r.campaign_id) || { spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0 };
      perfBycamp.set(r.campaign_id, {
        spend: prev.spend + (Number(r.spend) || 0),
        impressions: prev.impressions + (Number(r.impressions) || 0),
        clicks: prev.clicks + (Number(r.clicks) || 0),
        orders: prev.orders + (Number(r.orders) || 0),
        revenue: prev.revenue + (Number(r.revenue) || 0),
      });
    }
    return campaigns.map(c => {
      const perf = perfBycamp.get(c.id) || { spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0 };
      return {
        ...c,
        perf_spend: perf.spend,
        perf_impressions: perf.impressions,
        perf_clicks: perf.clicks,
        perf_orders: perf.orders,
        perf_acos: perf.revenue > 0 ? (perf.spend / perf.revenue) * 100 : 0,
      };
    });
  }, [campaigns, campPerf]);

  // Auto-sync reports (1-hour cache)
  const queryClient = useQueryClient();
  const cacheKey = `bolcom-reports-last-sync-${tenantId}`;

  const { isFetching: reportsSyncing } = useQuery({
    queryKey: ['bolcom-reports-sync', tenantId, period],
    enabled: !!tenantId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async () => {
      const lastSync = localStorage.getItem(cacheKey);
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      if (lastSync && Number(lastSync) > oneHourAgo) {
        return { skipped: true };
      }

      const endDate = todayStr;
      const startDate = currentStart;

      const { data, error } = await supabase.functions.invoke('ads-bolcom-reports', {
        body: { tenant_id: tenantId, start_date: startDate, end_date: endDate },
      });

      if (error) {
        console.error('Reports sync error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('Reports sync API error:', data.error);
        throw new Error(data.error);
      }

      localStorage.setItem(cacheKey, String(Date.now()));

      // Invalidate performance queries to pick up new data
      queryClient.invalidateQueries({ queryKey: ['bolcom-performance'] });
      queryClient.invalidateQueries({ queryKey: ['bolcom-campaign-perf'] });
      queryClient.invalidateQueries({ queryKey: ['bolcom-top-keywords'] });
      queryClient.invalidateQueries({ queryKey: ['bolcom-top-search-terms'] });

      return data;
    },
  });

  const forceReportsSync = () => {
    if (tenantId) {
      localStorage.removeItem(cacheKey);
      queryClient.invalidateQueries({ queryKey: ['bolcom-reports-sync'] });
    }
  };

  const isLoading = perfLoading || campLoading;
  const hasData = (campaigns?.length || 0) > 0;

  return {
    period,
    setPeriod,
    isLoading,
    hasData,
    kpis,
    chartData,
    campaigns: enrichedCampaigns,
    topKeywords: topKeywords || [],
    topSearchTerms: topSearchTerms || [],
    reportsSyncing,
    forceReportsSync,
  };
}
