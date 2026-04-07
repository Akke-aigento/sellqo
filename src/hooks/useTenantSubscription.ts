import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { TenantSubscription, PlatformInvoice, TenantUsageWithLimits, PricingPlanFeatures } from '@/types/billing';

import { TenantContext } from '@/hooks/useTenant';

export function useTenantSubscription() {
  // Safely check if we're within TenantProvider - return null if not
  const tenantContext = useContext(TenantContext);
  const currentTenant = tenantContext?.currentTenant ?? null;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading, error } = useQuery({
    queryKey: ['tenant-subscription', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('tenant_subscriptions')
        .select(`
          *,
          pricing_plans (*)
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
      const [productsRes, ordersRes, customersRes, usersRes] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('tenant_id', currentTenant.id),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', currentTenant.id),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', currentTenant.id),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('tenant_id', currentTenant.id),
      ]);

      const plan = subscription.pricing_plan;
      const products = productsRes.count || 0;
      const orders = ordersRes.count || 0;
      const customers = customersRes.count || 0;
      const users = usersRes.count || 0;

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
          current: 0, // TODO: Calculate actual storage
          limit: plan.limit_storage_gb,
          percentage: 0,
        },
        users: {
          current: users,
          limit: plan.limit_users,
          percentage: calcPercentage(users, plan.limit_users),
        },
      };
    },
    enabled: !!currentTenant?.id && !!subscription?.pricing_plan,
  });

  const createCheckout = useMutation({
    mutationFn: async ({ planId, interval }: { planId: string; interval: 'monthly' | 'yearly' }) => {
      const { data, error } = await supabase.functions.invoke('create-platform-checkout', {
        body: { planId, interval, tenant_id: currentTenant?.id },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij checkout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const openCustomerPortal = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('platform-customer-portal', {
        body: { tenant_id: currentTenant?.id },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij openen portaal',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    subscription,
    invoices: invoices ?? [],
    usage,
    isLoading,
    invoicesLoading,
    usageLoading,
    createCheckout,
    openCustomerPortal,
  };
}
