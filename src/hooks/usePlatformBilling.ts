import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { TenantSubscription, PlatformInvoice, BillingMetrics, PricingPlanFeatures } from '@/types/billing';

// Hook for platform admins to manage all tenant subscriptions
export function usePlatformBilling() {
  const { isPlatformAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['platform-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_subscriptions')
        .select(`
          *,
          pricing_plans (*),
          tenants (id, name, owner_email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(sub => ({
        ...sub,
        pricing_plan: sub.pricing_plans ? {
          ...sub.pricing_plans,
          features: sub.pricing_plans.features as unknown as PricingPlanFeatures
        } : undefined
      }));
    },
    enabled: isPlatformAdmin,
  });

  const { data: metrics } = useQuery({
    queryKey: ['platform-billing-metrics'],
    queryFn: async (): Promise<BillingMetrics> => {
      // Get all active subscriptions with plans
      const { data: subs, error } = await supabase
        .from('tenant_subscriptions')
        .select(`
          *,
          pricing_plans (*)
        `)
        .in('status', ['active', 'trialing']);

      if (error) throw error;

      let mrr = 0;
      const byPlanMap = new Map<string, { planId: string; planName: string; count: number; mrr: number }>();

      for (const sub of subs || []) {
        const plan = sub.pricing_plans;
        if (!plan) continue;

        const monthlyAmount = sub.billing_interval === 'yearly' 
          ? Number(plan.yearly_price) / 12 
          : Number(plan.monthly_price);
        
        mrr += monthlyAmount;

        const existing = byPlanMap.get(plan.id) || { 
          planId: plan.id, 
          planName: plan.name, 
          count: 0, 
          mrr: 0 
        };
        existing.count += 1;
        existing.mrr += monthlyAmount;
        byPlanMap.set(plan.id, existing);
      }

      // Get canceled count for churn (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: canceledCount } = await supabase
        .from('tenant_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'canceled')
        .gte('canceled_at', thirtyDaysAgo.toISOString());

      const payingCustomers = (subs || []).filter(s => 
        s.pricing_plans && Number(s.pricing_plans.monthly_price) > 0
      ).length;

      const totalActiveStart = payingCustomers + (canceledCount || 0);
      const churnRate = totalActiveStart > 0 ? ((canceledCount || 0) / totalActiveStart) * 100 : 0;

      return {
        mrr,
        arr: mrr * 12,
        payingCustomers,
        churnRate,
        byPlan: Array.from(byPlanMap.values()).sort((a, b) => b.mrr - a.mrr),
      };
    },
    enabled: isPlatformAdmin,
  });

  const { data: allInvoices } = useQuery({
    queryKey: ['platform-all-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_invoices')
        .select(`
          *,
          tenants (id, name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as (PlatformInvoice & { tenants: { id: string; name: string } })[];
    },
    enabled: isPlatformAdmin,
  });

  const { data: atRiskTenants } = useQuery({
    queryKey: ['platform-at-risk-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_subscriptions')
        .select(`
          *,
          pricing_plans (*),
          tenants (id, name, owner_email)
        `)
        .eq('status', 'past_due')
        .order('updated_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: isPlatformAdmin,
  });

  const giftMonth = useMutation({
    mutationFn: async ({ tenantId, months }: { tenantId: string; months: number }) => {
      const { data, error } = await supabase.functions.invoke('platform-gift-month', {
        body: { tenantId, months },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Gratis maand toegevoegd' });
      queryClient.invalidateQueries({ queryKey: ['platform-subscriptions'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  return {
    subscriptions: subscriptions ?? [],
    metrics,
    allInvoices: allInvoices ?? [],
    atRiskTenants: atRiskTenants ?? [],
    isLoading,
    giftMonth,
  };
}
