import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { subDays, format } from 'date-fns';
import { toast } from 'sonner';

export type Period = '7d' | '30d' | '90d';

function getPeriodDays(p: Period) { return p === '7d' ? 7 : p === '30d' ? 30 : 90; }

export function useBolcomCampaignDetail(campaignId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>('30d');

  const days = getPeriodDays(period);
  const now = new Date();
  const currentStart = format(subDays(now, days), 'yyyy-MM-dd');
  const todayStr = format(now, 'yyyy-MM-dd');

  // Campaign
  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ['bolcom-campaign', campaignId],
    enabled: !!campaignId && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ads_bolcom_campaigns')
        .select('*')
        .eq('id', campaignId!)
        .eq('tenant_id', tenantId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Performance chart data
  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ['bolcom-campaign-chart', campaignId, period],
    enabled: !!campaignId && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ads_bolcom_performance')
        .select('date, spend, revenue, acos')
        .eq('campaign_id', campaignId!)
        .eq('tenant_id', tenantId!)
        .gte('date', currentStart)
        .lte('date', todayStr)
        .order('date');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Ad groups
  const { data: adGroups, isLoading: adGroupsLoading } = useQuery({
    queryKey: ['bolcom-campaign-adgroups', campaignId],
    enabled: !!campaignId && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ads_bolcom_adgroups')
        .select('*')
        .eq('campaign_id', campaignId!)
        .eq('tenant_id', tenantId!)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // All keywords for this campaign's ad groups
  const adGroupIds = useMemo(() => (adGroups ?? []).map(ag => ag.id), [adGroups]);

  const { data: keywords, isLoading: keywordsLoading } = useQuery({
    queryKey: ['bolcom-campaign-keywords', adGroupIds],
    enabled: adGroupIds.length > 0 && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ads_bolcom_keywords')
        .select('*')
        .in('adgroup_id', adGroupIds)
        .eq('tenant_id', tenantId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Keyword performance aggregated
  const { data: keywordPerf } = useQuery({
    queryKey: ['bolcom-keyword-perf', campaignId, period],
    enabled: !!campaignId && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ads_bolcom_performance')
        .select('keyword_id, impressions, clicks, spend, orders, revenue, acos')
        .eq('campaign_id', campaignId!)
        .eq('tenant_id', tenantId!)
        .gte('date', currentStart)
        .lte('date', todayStr)
        .not('keyword_id', 'is', null);
      if (error) throw error;
      // Aggregate by keyword_id
      const map: Record<string, { impressions: number; clicks: number; spend: number; orders: number; revenue: number }> = {};
      (data ?? []).forEach(row => {
        const kid = row.keyword_id!;
        if (!map[kid]) map[kid] = { impressions: 0, clicks: 0, spend: 0, orders: 0, revenue: 0 };
        map[kid].impressions += row.impressions ?? 0;
        map[kid].clicks += row.clicks ?? 0;
        map[kid].spend += row.spend ?? 0;
        map[kid].orders += row.orders ?? 0;
        map[kid].revenue += row.revenue ?? 0;
      });
      return map;
    },
  });

  // Ad group performance aggregated
  const { data: adGroupPerf } = useQuery({
    queryKey: ['bolcom-adgroup-perf', campaignId, period],
    enabled: !!campaignId && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ads_bolcom_performance')
        .select('adgroup_id, spend, revenue, acos')
        .eq('campaign_id', campaignId!)
        .eq('tenant_id', tenantId!)
        .gte('date', currentStart)
        .lte('date', todayStr)
        .not('adgroup_id', 'is', null);
      if (error) throw error;
      const map: Record<string, { spend: number; revenue: number }> = {};
      (data ?? []).forEach(row => {
        const aid = row.adgroup_id!;
        if (!map[aid]) map[aid] = { spend: 0, revenue: 0 };
        map[aid].spend += row.spend ?? 0;
        map[aid].revenue += row.revenue ?? 0;
      });
      return map;
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['bolcom-campaign', campaignId] });
    qc.invalidateQueries({ queryKey: ['bolcom-campaign-adgroups', campaignId] });
    qc.invalidateQueries({ queryKey: ['bolcom-campaign-keywords'] });
  };

  // Mutations
  const updateCampaignStatus = useMutation({
    mutationFn: async (status: string) => {
      const action = status === 'paused' ? 'pause_campaign' : 'resume_campaign';
      const { data, error } = await supabase.functions.invoke('ads-bolcom-manage', {
        body: { tenant_id: tenantId, action, payload: { campaign_id: campaignId } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { invalidateAll(); toast.success('Campagnestatus bijgewerkt'); },
    onError: () => toast.error('Fout bij bijwerken status'),
  });

  const updateKeywordBid = useMutation({
    mutationFn: async ({ keywordId, bid }: { keywordId: string; bid: number }) => {
      const { data, error } = await supabase.functions.invoke('ads-bolcom-manage', {
        body: { tenant_id: tenantId, action: 'update_bid', payload: { keyword_id: keywordId, new_bid: bid } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bolcom-campaign-keywords'] }); toast.success('Bod bijgewerkt'); },
    onError: () => toast.error('Fout bij bijwerken bod'),
  });

  const toggleKeywordStatus = useMutation({
    mutationFn: async ({ keywordId, status }: { keywordId: string; status: string }) => {
      const action = status === 'paused' ? 'pause_keyword' : 'resume_keyword';
      const { data, error } = await supabase.functions.invoke('ads-bolcom-manage', {
        body: { tenant_id: tenantId, action, payload: { keyword_id: keywordId } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bolcom-campaign-keywords'] }); },
  });

  const addKeyword = useMutation({
    mutationFn: async (params: { adgroupId: string; keyword: string; matchType: string; bid: number }) => {
      const { error } = await supabase
        .from('ads_bolcom_keywords')
        .insert({
          adgroup_id: params.adgroupId,
          keyword: params.keyword,
          match_type: params.matchType,
          bid: params.bid,
          status: 'active',
          is_negative: false,
          tenant_id: tenantId!,
        });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bolcom-campaign-keywords'] }); toast.success('Keyword toegevoegd'); },
    onError: () => toast.error('Fout bij toevoegen keyword'),
  });

  const deleteCampaign = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('ads-bolcom-manage', {
        body: { tenant_id: tenantId, action: 'delete_campaign', payload: { campaign_id: campaignId } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bolcom-campaigns'] });
      toast.success('Campagne verwijderd');
    },
    onError: () => toast.error('Fout bij verwijderen campagne'),
  });

  const addNegativeKeyword = useMutation({
    mutationFn: async (params: { adgroupId: string; keyword: string; matchType: string }) => {
      const { data, error } = await supabase.functions.invoke('ads-bolcom-manage', {
        body: { tenant_id: tenantId, action: 'add_negative_keyword', payload: { adgroup_id: params.adgroupId, keyword: params.keyword, match_type: params.matchType } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bolcom-campaign-keywords'] }); toast.success('Negatief keyword toegevoegd'); },
    onError: () => toast.error('Fout bij toevoegen negatief keyword'),
  });

  const isLoading = campaignLoading || chartLoading || adGroupsLoading || keywordsLoading;

  // Split keywords
  const positiveKeywords = useMemo(() => (keywords ?? []).filter(k => !k.is_negative), [keywords]);
  const negativeKeywords = useMemo(() => (keywords ?? []).filter(k => k.is_negative), [keywords]);

  return {
    campaign,
    chartData: chartData ?? [],
    adGroups: adGroups ?? [],
    positiveKeywords,
    negativeKeywords,
    keywordPerf: keywordPerf ?? {},
    adGroupPerf: adGroupPerf ?? {},
    isLoading,
    period,
    setPeriod,
    updateCampaignStatus,
    updateKeywordBid,
    toggleKeywordStatus,
    addKeyword,
    addNegativeKeyword,
    deleteCampaign,
  };
}
