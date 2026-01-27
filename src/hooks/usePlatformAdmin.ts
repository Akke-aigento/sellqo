import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TenantSubscription, PlatformInvoice, PricingPlan } from '@/types/billing';

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  subscription_status: string;
  subscription_plan: string;
  created_at: string;
  updated_at: string;
  lifetime_revenue?: number;
  lifetime_order_count?: number;
  lifetime_customer_count?: number;
  stripe_account_id?: string;
  stripe_onboarding_complete?: boolean;
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

export interface TenantOwner {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface TenantStats {
  total: number;
  active: number;
  trialing: number;
  internal: number;
}

export function usePlatformAdmin() {
  const queryClient = useQueryClient();

  // Fetch platform tenant stats
  const useTenantStats = () => {
    return useQuery({
      queryKey: ['platform-tenant-stats'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, subscription_status, is_internal_tenant');
        
        if (error) throw error;
        
        const stats: TenantStats = {
          total: data?.length || 0,
          active: data?.filter(t => t.subscription_status === 'active').length || 0,
          trialing: data?.filter(t => t.subscription_status === 'trialing').length || 0,
          internal: data?.filter(t => t.is_internal_tenant).length || 0,
        };
        
        return stats;
      },
    });
  };

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

  // Fetch tenant owner info (from tenant record itself)
  const useTenantOwner = (tenantId: string) => {
    return useQuery({
      queryKey: ['platform-tenant-owner', tenantId],
      queryFn: async () => {
        const { data: tenant, error } = await supabase
          .from('tenants')
          .select('owner_email, owner_name, created_at')
          .eq('id', tenantId)
          .single();
        
        if (error) throw error;
        if (!tenant?.owner_email) return null;
        
        return {
          id: tenantId,
          email: tenant.owner_email,
          full_name: tenant.owner_name || null,
          created_at: tenant.created_at || '',
          last_sign_in_at: null,
        } as TenantOwner;
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

  // Fetch all pricing plans
  const usePricingPlans = () => {
    return useQuery({
      queryKey: ['platform-pricing-plans'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('pricing_plans')
          .select('id, name, monthly_price, yearly_price')
          .order('monthly_price', { ascending: true });
        
        if (error) throw error;
        return data as { id: string; name: string; monthly_price: number; yearly_price: number }[];
      },
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

  // Update subscription mutation
  const updateSubscription = useMutation({
    mutationFn: async ({ 
      tenantId, 
      updates 
    }: { 
      tenantId: string; 
      updates: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from('tenant_subscriptions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId);

      if (error) throw error;

      // Update tenant subscription_status if status changed
      if (updates.status) {
        await supabase
          .from('tenants')
          .update({ 
            subscription_status: updates.status as string,
            updated_at: new Date().toISOString() 
          })
          .eq('id', tenantId);
      }

      // Log the action
      await supabase.rpc('log_admin_action', {
        p_action_type: 'subscription_updated',
        p_target_tenant_id: tenantId,
        p_action_details: updates as unknown as Record<string, never>,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-subscription', variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant', variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['platform-tenant-actions', variables.tenantId] });
      toast.success('Abonnement bijgewerkt');
    },
    onError: (error) => {
      toast.error('Fout bij bijwerken abonnement: ' + error.message);
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
    useTenantStats,
    useTenantDetail,
    useTenantOwner,
    useTenantCredits,
    useTenantSubscription,
    usePricingPlans,
    useTenantFeatureOverrides,
    useTenantInvoices,
    useTenantAdminActions,
    useFeatureUsageStats,
    adjustCredits,
    updateSubscription,
    updateFeatureOverrides,
  };
}
