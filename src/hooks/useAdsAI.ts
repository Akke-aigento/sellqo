import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

export function useAdsAI() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // Filters
  const [channel, setChannel] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>('pending');

  // Recommendations query
  const { data: rawRecommendations = [], isLoading: loadingRecs } = useQuery({
    queryKey: ['ads-ai-recommendations', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('ads_ai_recommendations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Rules query
  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ['ads-ai-rules', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('ads_ai_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // History query (accepted / auto_applied)
  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['ads-ai-history', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('ads_ai_recommendations')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['accepted', 'auto_applied'])
        .order('applied_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Pending count
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['ads-ai-pending-count', tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const { count, error } = await supabase
        .from('ads_ai_recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending');
      if (error) return 0;
      return count || 0;
    },
    enabled: !!tenantId,
  });

  // Default rule creation — only once per tenant
  const defaultRuleCreated = useRef(false);
  useEffect(() => {
    if (!tenantId || loadingRules || defaultRuleCreated.current) return;
    if (rules.length > 0) {
      defaultRuleCreated.current = true;
      return;
    }
    defaultRuleCreated.current = true;
    createRule.mutate({
      name: 'Verspillende zoektermen blokkeren',
      channel: 'bolcom',
      rule_type: 'auto_negative',
      conditions: { min_clicks: 10, max_conversions: 0, min_spend: 5.00, lookback_days: 14 },
      actions: { add_as_negative: true, match_type: 'exact' },
      is_active: true,
    });
  }, [tenantId, loadingRules, rules.length]);

  // Filtered recommendations
  const recommendations = useMemo(() => {
    return rawRecommendations.filter((r) => {
      if (channel && channel !== 'all' && r.channel !== channel) return false;
      if (type && r.recommendation_type !== type) return false;
      if (status && r.status !== status) return false;
      return true;
    });
  }, [rawRecommendations, channel, type, status]);

  // Mutations
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['ads-ai-recommendations'] });
    queryClient.invalidateQueries({ queryKey: ['ads-ai-history'] });
  };

  const applyRecommendation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ads_ai_recommendations')
        .update({ status: 'accepted', applied_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Aanbeveling toegepast');
      invalidate();
    },
    onError: () => toast.error('Kon aanbeveling niet toepassen'),
  });

  const rejectRecommendation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ads_ai_recommendations')
        .update({ status: 'rejected' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Aanbeveling genegeerd');
      invalidate();
    },
    onError: () => toast.error('Kon aanbeveling niet negeren'),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('ads_ai_rules')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Regel bijgewerkt');
      queryClient.invalidateQueries({ queryKey: ['ads-ai-rules'] });
    },
    onError: () => toast.error('Kon regel niet bijwerken'),
  });

  const createRule = useMutation({
    mutationFn: async (data: {
      name: string;
      channel: string | null;
      rule_type: string;
      conditions: Record<string, unknown>;
      actions: Record<string, unknown>;
      is_active?: boolean;
    }) => {
      if (!tenantId) throw new Error('No tenant');
      const { error } = await supabase.from('ads_ai_rules').insert({
        tenant_id: tenantId,
        name: data.name,
        channel: data.channel,
        rule_type: data.rule_type,
        conditions: data.conditions as any,
        actions: data.actions as any,
        is_active: data.is_active ?? true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Regel aangemaakt');
      queryClient.invalidateQueries({ queryKey: ['ads-ai-rules'] });
    },
    onError: () => toast.error('Kon regel niet aanmaken'),
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; channel?: string | null; rule_type?: string; conditions?: Record<string, unknown>; actions?: Record<string, unknown>; is_active?: boolean }) => {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.channel !== undefined) updateData.channel = data.channel;
      if (data.rule_type !== undefined) updateData.rule_type = data.rule_type;
      if (data.conditions !== undefined) updateData.conditions = data.conditions;
      if (data.actions !== undefined) updateData.actions = data.actions;
      if (data.is_active !== undefined) updateData.is_active = data.is_active;
      const { error } = await supabase.from('ads_ai_rules').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Regel bijgewerkt');
      queryClient.invalidateQueries({ queryKey: ['ads-ai-rules'] });
    },
    onError: () => toast.error('Kon regel niet bijwerken'),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ads_ai_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Regel verwijderd');
      queryClient.invalidateQueries({ queryKey: ['ads-ai-rules'] });
    },
    onError: () => toast.error('Kon regel niet verwijderen'),
  });

  return {
    // Data
    recommendations,
    rules,
    history,
    // Loading
    loadingRecs,
    loadingRules,
    loadingHistory,
    // Filters
    channel, setChannel,
    type, setType,
    status, setStatus,
    // Mutations
    applyRecommendation,
    rejectRecommendation,
    toggleRule,
    createRule,
    updateRule,
    deleteRule,
  };
}
