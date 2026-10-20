import { useQuery } from '@tanstack/react-query';
import { useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { countUsage } from '@/lib/planUsage';
import { fetchMarketingEmailUsage } from '@/hooks/useMarketingEmailUsage';
import type { TenantSubscription, PlatformInvoice, TenantUsageWithLimits, PricingPlanFeatures } from '@/types/billing';

import { TenantContext } from '@/hooks/useTenant';

export function useTenantSubscription() {
  // Safely check if we're within TenantProvider - return null if not
  const tenantContext = useContext(TenantContext);
  const currentTenant = tenantContext?.currentTenant ?? null;

  const { data: subscription, isLoading, error } = useQuery({
    queryKey: ['tenant-subscription', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('tenant_subscriptions')
        .select(`
          *,
          pricing_plans!plan_id (*)
        `)
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return null;
      
      return {
        ...data,
        pricing_plan: data.pricing_plans ? {
          ...data.pricing_plans,
          features: data.pricing_plans.features as unknown as PricingPlanFeatures
        } : undefined
      } as TenantSubscription;
    },
    enabled: !!currentTenant?.id,
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['platform-invoices', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('platform_invoices')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PlatformInvoice[];
    },
    enabled: !!currentTenant?.id,
  });

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['tenant-usage', currentTenant?.id],
    queryFn: async (): Promise<TenantUsageWithLimits | null> => {
      if (!currentTenant?.id || !subscription?.pricing_plan) return null;

      // Get counts
      // LIMITS-1: zelfde telling als de databank (src/lib/planUsage.ts).
      const [products, orders, crmCustomersRes, storefrontCustomersRes, users, storageRes, mail] = await Promise.all([
        countUsage(currentTenant.id, 'products'),
        countUsage(currentTenant.id, 'orders'),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', currentTenant.id),
        supabase.from('storefront_customers').select('id', { count: 'exact', head: true }).eq('tenant_id', currentTenant.id),
        countUsage(currentTenant.id, 'users'),
        supabase.rpc('get_tenant_storage_bytes', { p_tenant_id: currentTenant.id }),
        // MAIL-LIMIT-UI: faalt de RPC (bv. rol zonder Marketing-leesrecht), dan valt alleen deze regel weg.
        fetchMarketingEmailUsage(currentTenant.id).catch(() => null),
      ]);

      const plan = subscription.pricing_plan;
      const customers = (crmCustomersRes.count || 0) + (storefrontCustomersRes.count || 0);
      const storageBytes = (storageRes.data as number) || 0;
      const storageGb = Number((storageBytes / (1024 * 1024 * 1024)).toFixed(2));

      const calcPercentage = (current: number, limit: number | null) => 
        limit ? (current / limit) * 100 : 0;

      return {
        products: {
          current: products,
          limit: plan.limit_products,
          percentage: calcPercentage(products, plan.limit_products),
        },
        orders: {
          current: orders,
          limit: plan.limit_orders,
          percentage: calcPercentage(orders, plan.limit_orders),
        },
        customers: {
          current: customers,
          limit: plan.limit_customers,
          percentage: calcPercentage(customers, plan.limit_customers),
        },
        storage: {
          current: storageGb,
          limit: plan.limit_storage_gb,
          percentage: calcPercentage(storageGb, plan.limit_storage_gb),
        },
        users: {
          current: users,
          limit: plan.limit_users,
          percentage: calcPercentage(users, plan.limit_users),
        },
        ...(mail ? {
          marketing_emails: {
            current: mail.used,
            limit: mail.monthly,
            percentage: calcPercentage(mail.used, mail.monthly),
          },
        } : {}),
      };
    },
    enabled: !!currentTenant?.id && !!subscription?.pricing_plan,
  });

  return {
    subscription,
    invoices: invoices ?? [],
    usage,
    isLoading,
    invoicesLoading,
    usageLoading,
  };
}
