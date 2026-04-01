import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { subDays, format } from 'date-fns';
import { toast } from 'sonner';

export type Period = '7d' | '30d' | '90d';

function getPeriodDays(p: Period) { return p === '7d' ? 7 : p === '30d' ? 30 : 90; }

export interface KeywordWithContext {
  id: string;
  keyword: string;
  match_type: string;
  bid: number | null;
  status: string;
  is_negative: boolean | null;
  adgroup_id: string;
  adgroup_name: string;
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  spend: number;
  orders: number;
  revenue: number;
  acos: number;
  ctr: number;
}

type SortKey = 'keyword' | 'bid' | 'impressions' | 'clicks' | 'spend' | 'orders' | 'revenue' | 'acos' | 'ctr';
type SortDir = 'asc' | 'desc';

export function useBolcomKeywords() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>('30d');
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  const [matchTypeFilter, setMatchTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('clicks');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const days = getPeriodDays(period);
  const now = new Date();
  const currentStart = format(subDays(now, days), 'yyyy-MM-dd');
  const todayStr = format(now, 'yyyy-MM-dd');

  // Campaigns list (for filter dropdown)
  const { data: campaigns } = useQuery({
    queryKey: ['bolcom-campaigns', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ads_bolcom_campaigns')
        .select('id, name')
        .eq('tenant_id', tenantId!)
        .order('name');
      return data || [];
    },
  });

  // All keywords with adgroup + campaign info
  const { data: rawKeywords, isLoading: kwLoading } = useQuery({
    queryKey: ['bolcom-all-keywords', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ads_bolcom_keywords')
        .select('*, ads_bolcom_adgroups!inner(id, name, campaign_id, ads_bolcom_campaigns!inner(id, name))')
        .eq('tenant_id', tenantId!)
        .eq('is_negative', false);
      if (error) throw error;
      return (data || []).map((k: any) => ({
        id: k.id,
        keyword: k.keyword,
        match_type: k.match_type,
        bid: k.bid,
        status: k.status,
        is_negative: k.is_negative,
        adgroup_id: k.adgroup_id,
        adgroup_name: k.ads_bolcom_adgroups?.name ?? '',
        campaign_id: k.ads_bolcom_adgroups?.campaign_id ?? '',
        campaign_name: k.ads_bolcom_adgroups?.ads_bolcom_campaigns?.name ?? '',
      }));
    },
  });

  // Performance per keyword
  const { data: perfMap } = useQuery({
    queryKey: ['bolcom-all-keyword-perf', tenantId, period],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ads_bolcom_performance')
        .select('keyword_id, impressions, clicks, spend, orders, revenue')
        .eq('tenant_id', tenantId!)
        .gte('date', currentStart)
        .lte('date', todayStr)
        .not('keyword_id', 'is', null);
      const map: Record<string, { impressions: number; clicks: number; spend: number; orders: number; revenue: number }> = {};
      (data || []).forEach(r => {
        const kid = r.keyword_id!;
        if (!map[kid]) map[kid] = { impressions: 0, clicks: 0, spend: 0, orders: 0, revenue: 0 };
        map[kid].impressions += r.impressions ?? 0;
        map[kid].clicks += r.clicks ?? 0;
        map[kid].spend += r.spend ?? 0;
        map[kid].orders += r.orders ?? 0;
        map[kid].revenue += r.revenue ?? 0;
      });
      return map;
    },
  });

  // Enrich, filter, sort
  const keywords = useMemo<KeywordWithContext[]>(() => {
    if (!rawKeywords) return [];
    const pm = perfMap || {};

    let list: KeywordWithContext[] = rawKeywords.map(k => {
      const p = pm[k.id] || { impressions: 0, clicks: 0, spend: 0, orders: 0, revenue: 0 };
      return {
        ...k,
        ...p,
        acos: p.revenue > 0 ? (p.spend / p.revenue) * 100 : 0,
        ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
      };
    });

    // Filters
    if (campaignFilter) list = list.filter(k => k.campaign_id === campaignFilter);
    if (matchTypeFilter) list = list.filter(k => k.match_type === matchTypeFilter);
    if (statusFilter) list = list.filter(k => k.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(k => k.keyword.toLowerCase().includes(s));
    }

    // Sort
    list.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === 'string') return sortDir === 'asc' ? (aVal as string).localeCompare(bVal as string) : (bVal as string).localeCompare(aVal as string);
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return list;
  }, [rawKeywords, perfMap, campaignFilter, matchTypeFilter, statusFilter, search, sortKey, sortDir]);

  // KPI summary
  const summary = useMemo(() => {
    const activeKws = keywords.filter(k => k.status === 'active');
    const totalActive = activeKws.length;
    const avgBid = totalActive > 0
      ? activeKws.reduce((s, k) => s + (k.bid ?? 0), 0) / totalActive
      : 0;
    const totalSpend = keywords.reduce((s, k) => s + k.spend, 0);
    const bestKw = keywords
      .filter(k => k.clicks >= 10 && k.acos > 0)
      .sort((a, b) => a.acos - b.acos)[0];
    return { totalActive, avgBid, totalSpend, bestKeyword: bestKw?.keyword ?? '-', bestAcos: bestKw?.acos ?? 0 };
  }, [keywords]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === keywords.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(keywords.map(k => k.id)));
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bolcom-all-keywords'] });
    qc.invalidateQueries({ queryKey: ['bolcom-all-keyword-perf'] });
  };

  const updateKeywordBid = useMutation({
    mutationFn: async ({ keywordId, bid }: { keywordId: string; bid: number }) => {
      const { error } = await supabase
        .from('ads_bolcom_keywords')
        .update({ bid })
        .eq('id', keywordId)
        .eq('tenant_id', tenantId!);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Bod bijgewerkt'); },
    onError: () => toast.error('Fout bij bijwerken bod'),
  });

  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase
        .from('ads_bolcom_keywords')
        .update({ status })
        .in('id', ids)
        .eq('tenant_id', tenantId!);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setSelectedIds(new Set()); toast.success('Status bijgewerkt'); },
    onError: () => toast.error('Fout bij bijwerken status'),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('ads_bolcom_keywords')
        .delete()
        .in('id', ids)
        .eq('tenant_id', tenantId!);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setSelectedIds(new Set()); toast.success('Keywords verwijderd'); },
    onError: () => toast.error('Fout bij verwijderen'),
  });

  return {
    keywords,
    campaigns: campaigns || [],
    summary,
    isLoading: kwLoading,
    period, setPeriod,
    campaignFilter, setCampaignFilter,
    matchTypeFilter, setMatchTypeFilter,
    statusFilter, setStatusFilter,
    search, setSearch,
    sortKey, sortDir, toggleSort,
    selectedIds, toggleSelect, toggleSelectAll,
    updateKeywordBid,
    bulkUpdateStatus,
    bulkDelete,
  };
}
