import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TenantSubscription, PlatformInvoice } from '@/types/billing';

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  subscription_status: string;
  subscription_plan: string;
  created_at: string;
  updated_at: string;
}

export interface TenantAICredits {
  id: string;
  tenant_id: string;
  credits_total: number;
  credits_used: number;
  credits_purchased: number;
  credits_reset_at: string | null;
}

export interface TenantFeatureOverride {
  id: string;
  tenant_id: string;
  module_ai_marketing: boolean | null;
  module_peppol: boolean | null;
  module_multi_currency: boolean | null;
  module_advanced_analytics: boolean | null;
  module_api_access: boolean | null;
  module_webhooks: boolean | null;
  module_white_label: boolean | null;
  limit_products_override: number | null;
  limit_orders_override: number | null;
  limit_customers_override: number | null;
  limit_users_override: number | null;
  limit_storage_gb_override: number | null;
  extended_trial_until: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminAction {
  id: string;
  admin_user_id: string;
  target_tenant_id: string | null;
  target_user_id: string | null;
  action_type: string;
  action_details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface FeatureUsageStats {
  feature_name: string;
  count: number;
}

export function usePlatformAdmin() {
  const queryClient = useQueryClient();

  // Fetch single tenant details
  const useTenantDetail = (tenantId: string) => {
    return useQuery({
      queryKey: ['platform-tenant', tenantId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', tenantId)
          .single();
        
        if (error) throw error;
        return data as TenantDetail;
      },
      enabled: !!tenantId,
    });
  };

  // Fetch tenant AI credits
  const useTenantCredits = (tenantId: string) => {
    return useQuery({
      queryKey: ['platform-tenant-credits', tenantId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('tenant_ai_credits')
          .select('*')
          .eq('tenant_id', tenantId)
          .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data as TenantAICredits | null;
      },
      enabled: !!tenantId,
    });
  };

  // Fetch tenant subscription
  const useTenantSubscription = (tenantId: string) => {
    return useQuery({
      queryKey: ['platform-tenant-subscription', tenantId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('tenant_subscriptions')
          .select('*, pricing_plans(*)')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        
        if (error) throw error;
        return data as (TenantSubscription & { pricing_plans: unknown }) | null;
      },
      enabled: !!tenantId,
    });
  };

  // Fetch tenant feature overrides
  const useTenantFeatureOverrides = (tenantId: string) => {
    return useQuery({
      queryKey: ['platform-tenant-overrides', tenantId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('tenant_feature_overrides')
          .select('*')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        
        if (error) throw error;
        return data as TenantFeatureOverride | null;
      },
      enabled: !!tenantId,
    });
  };

  // Fetch tenant invoices
  const useTenantInvoices = (tenantId: string) => {
    return useQuery({
      queryKey: ['platform-tenant-invoices', tenantId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('platform_invoices')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data as PlatformInvoice[];
      },
      enabled: !!tenantId,
    });
  };

  // Fetch admin actions for tenant
  const useTenantAdminActions = (tenantId: string) => {
    return useQuery({
      queryKey: ['platform-tenant-actions', tenantId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('admin_actions_log')
          .select('*')
          .eq('target_tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (error) throw error;
        return data as AdminAction[];
      },
      enabled: !!tenantId,
    });
  };

  // Fetch feature usage stats
  const useFeatureUsageStats = (tenantId?: string, days = 30) => {
    return useQuery({
      queryKey: ['platform-feature-usage', tenantId, days],
      queryFn: async () => {
        let query = supabase
          .from('feature_usage_events')
          .select('feature_name');

        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }

        const since = new Date();
        since.setDate(since.getDate() - days);
        query = query.gte('created_at', since.toISOString());

        const { data, error } = await query;
        if (error) throw error;

        // Group and count
        const counts: Record<string, number> = {};
        (data || []).forEach((row: { feature_name: string }) => {
          counts[row.feature_name] = (counts[row.feature_name] || 0) + 1;
        });

        return Object.entries(counts)
          .map(([feature_name, count]) => ({ feature_name, count }))
          .sort((a, b) => b.count - a.count) as FeatureUsageStats[];
      },
    });
  };

  // Adjust AI credits mutation
  const adjustCredits = useMutation({
    mutationFn: async ({ 
      tenantId, 
      adjustment, 
      reason 
    }: { 
      tenantId: string; 
      adjustment: number; 
      reason: string;
    }) => {
      const { data, error } = await supabase.rpc('admin_adjust_ai_credits', {
        p_tenant_id: tenantId,
        p_adjustment: adjustment,
        p_reason: reason,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-credits', variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-actions', variables.tenantId] });
      toast.success('AI credits aangepast');
    },
    onError: (error) => {
      toast.error('Fout bij aanpassen credits: ' + error.message);
    },
  });

  // Update feature overrides mutation
  const updateFeatureOverrides = useMutation({
    mutationFn: async ({ 
      tenantId, 
      overrides 
    }: { 
      tenantId: string; 
      overrides: Partial<TenantFeatureOverride>;
    }) => {
      const { data: existing } = await supabase
        .from('tenant_feature_overrides')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('tenant_feature_overrides')
          .update({ ...overrides, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_feature_overrides')
          .insert({ tenant_id: tenantId, ...overrides });
        if (error) throw error;
      }

      // Log the action
      await supabase.rpc('log_admin_action', {
        p_action_type: 'feature_override_updated',
        p_target_tenant_id: tenantId,
        p_action_details: overrides,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-overrides', variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-actions', variables.tenantId] });
      toast.success('Module instellingen opgeslagen');
    },
    onError: (error) => {
      toast.error('Fout bij opslaan: ' + error.message);
    },
  });

  return {
    useTenantDetail,
    useTenantCredits,
    useTenantSubscription,
    useTenantFeatureOverrides,
    useTenantInvoices,
    useTenantAdminActions,
    useFeatureUsageStats,
    adjustCredits,
    updateFeatureOverrides,
  };
}
