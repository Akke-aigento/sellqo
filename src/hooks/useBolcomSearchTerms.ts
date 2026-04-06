import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { subDays, format } from 'date-fns';
import { toast } from 'sonner';

export type Period = '7d' | '30d' | '90d';

function getPeriodDays(p: Period) { return p === '7d' ? 7 : p === '30d' ? 30 : 90; }

export interface SearchTermRow {
  id: string;
  search_term: string;
  campaign_id: string | null;
  campaign_name: string;
  adgroup_id: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  orders: number;
  revenue: number;
  acos: number;
  ctr: number;
  ai_action: string | null;
  ai_action_taken: boolean;
}

type SortKey = 'search_term' | 'impressions' | 'clicks' | 'spend' | 'orders' | 'revenue' | 'acos' | 'ctr';
type SortDir = 'asc' | 'desc';

export function useBolcomSearchTerms() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>('30d');
  const [search, setSearch] = useState('');
  const [onlyNoConversions, setOnlyNoConversions] = useState(false);
  const [onlyWithAiSuggestion, setOnlyWithAiSuggestion] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const days = getPeriodDays(period);
  const now = new Date();
  const currentStart = format(subDays(now, days), 'yyyy-MM-dd');
  const todayStr = format(now, 'yyyy-MM-dd');

  // Campaign lookup
  const { data: campaignMap } = useQuery({
    queryKey: ['bolcom-campaigns-map', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ads_bolcom_campaigns')
        .select('id, name')
        .eq('tenant_id', tenantId!);
      const map: Record<string, string> = {};
      (data || []).forEach(c => { map[c.id] = c.name; });
      return map;
    },
  });

  // Raw search terms
  const { data: rawTerms, isLoading } = useQuery({
    queryKey: ['bolcom-search-terms', tenantId, period],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ads_bolcom_search_terms')
        .select('*')
        .eq('tenant_id', tenantId!)
        .gte('date', currentStart)
        .lte('date', todayStr);
      if (error) throw error;
      return data || [];
    },
  });

  // Aggregate per search_term
  const searchTerms = useMemo<SearchTermRow[]>(() => {
    if (!rawTerms) return [];
    const cMap = campaignMap || {};

    // Group by search_term
    const grouped: Record<string, {
      ids: string[];
      campaign_id: string | null;
      adgroup_id: string | null;
      impressions: number;
      clicks: number;
      spend: number;
      orders: number;
      revenue: number;
      ai_action: string | null;
      ai_action_taken: boolean;
    }> = {};

    rawTerms.forEach(r => {
      const key = r.search_term;
      if (!grouped[key]) {
        grouped[key] = {
          ids: [],
          campaign_id: r.campaign_id,
          adgroup_id: r.adgroup_id,
          impressions: 0, clicks: 0, spend: 0, orders: 0, revenue: 0,
          ai_action: r.ai_action,
          ai_action_taken: r.ai_action_taken ?? false,
        };
      }
      const g = grouped[key];
      g.ids.push(r.id);
      g.impressions += r.impressions ?? 0;
      g.clicks += r.clicks ?? 0;
      g.spend += r.spend ?? 0;
      g.orders += r.orders ?? 0;
      g.revenue += r.revenue ?? 0;
      if (r.ai_action && !g.ai_action) g.ai_action = r.ai_action;
      if (r.ai_action_taken) g.ai_action_taken = true;
    });

    let list: SearchTermRow[] = Object.entries(grouped).map(([term, g]) => ({
      id: g.ids[0],
      search_term: term,
      campaign_id: g.campaign_id,
      campaign_name: g.campaign_id ? (cMap[g.campaign_id] ?? '-') : '-',
      adgroup_id: g.adgroup_id,
      impressions: g.impressions,
      clicks: g.clicks,
      spend: g.spend,
      orders: g.orders,
      revenue: g.revenue,
      acos: g.revenue > 0 ? (g.spend / g.revenue) * 100 : 0,
      ctr: g.impressions > 0 ? (g.clicks / g.impressions) * 100 : 0,
      ai_action: g.ai_action,
      ai_action_taken: g.ai_action_taken,
    }));

    // Filters
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(t => t.search_term.toLowerCase().includes(s));
    }
    if (onlyNoConversions) list = list.filter(t => t.orders === 0);
    if (onlyWithAiSuggestion) list = list.filter(t => t.ai_action && !t.ai_action_taken);

    // Sort
    list.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === 'string') return sortDir === 'asc' ? (aVal as string).localeCompare(bVal as string) : (bVal as string).localeCompare(aVal as string);
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return list;
  }, [rawTerms, campaignMap, search, onlyNoConversions, onlyWithAiSuggestion, sortKey, sortDir]);

  // Summary KPIs
  const summary = useMemo(() => {
    const all = searchTerms;
    const totalUnique = all.length;
    const withConversions = all.filter(t => t.orders > 0);
    const noConversions = all.filter(t => t.orders === 0 && t.spend > 0);
    const wastedSpend = noConversions.reduce((s, t) => s + t.spend, 0);
    const aiPending = all.filter(t => t.ai_action && !t.ai_action_taken).length;
    return {
      totalUnique,
      withConversions: withConversions.length,
      withConversionsPct: totalUnique > 0 ? (withConversions.length / totalUnique) * 100 : 0,
      noConversions: noConversions.length,
      wastedSpend,
      aiPending,
    };
  }, [searchTerms]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bolcom-search-terms'] });
    qc.invalidateQueries({ queryKey: ['bolcom-all-keywords'] });
  };

  const addAsNegativeKeyword = useMutation({
    mutationFn: async ({ searchTerm, adgroupId, matchType }: { searchTerm: string; adgroupId: string; matchType: string }) => {
      const { data, error } = await supabase.functions.invoke('ads-bolcom-manage', {
        body: { tenant_id: tenantId, action: 'add_negative_keyword', payload: { adgroup_id: adgroupId, keyword: searchTerm, match_type: matchType } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Mark ai_action_taken
      await supabase
        .from('ads_bolcom_search_terms')
        .update({ ai_action_taken: true })
        .eq('tenant_id', tenantId!)
        .eq('search_term', searchTerm);
    },
    onSuccess: () => { invalidate(); toast.success('Negatief keyword toegevoegd'); },
    onError: () => toast.error('Fout bij toevoegen negatief keyword'),
  });

  const promoteToKeyword = useMutation({
    mutationFn: async ({ searchTerm, adgroupId, matchType, bid }: { searchTerm: string; adgroupId: string; matchType: string; bid: number }) => {
      const { error } = await supabase
        .from('ads_bolcom_keywords')
        .insert({
          tenant_id: tenantId!,
          adgroup_id: adgroupId,
          keyword: searchTerm,
          match_type: matchType,
          is_negative: false,
          bid,
          status: 'active',
        });
      if (error) throw error;
      await supabase
        .from('ads_bolcom_search_terms')
        .update({ ai_action_taken: true })
        .eq('tenant_id', tenantId!)
        .eq('search_term', searchTerm);
    },
    onSuccess: () => { invalidate(); toast.success('Keyword toegevoegd'); },
    onError: () => toast.error('Fout bij toevoegen keyword'),
  });

  return {
    searchTerms,
    summary,
    isLoading,
    period, setPeriod,
    search, setSearch,
    onlyNoConversions, setOnlyNoConversions,
    onlyWithAiSuggestion, setOnlyWithAiSuggestion,
    sortKey, sortDir, toggleSort,
    addAsNegativeKeyword,
    promoteToKeyword,
  };
}
