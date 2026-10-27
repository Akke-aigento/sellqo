import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { PlatformInvoice, BillingMetrics, PricingPlanFeatures } from '@/types/billing';
import { usePlatformBillingOverview } from '@/hooks/usePlatformBillingOverview';

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
          pricing_plans!plan_id (*),
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

  // PLATFORM-FIGURES-1: cijfers uit platform_billing_overview() — wat er écht aangerekend,
  // betaald en openstaat. Tot 27-10 stond hier de lijstprijs van elk plan van elke tenant
  // (ook demo, intern en trial): MRR €3.253,50 bij één betalende klant.
  const overview = usePlatformBillingOverview();

  const { data: plans } = useQuery({
    queryKey: ['platform-pricing-plan-names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pricing_plans').select('id, name');
      if (error) throw error;
      return new Map((data || []).map((p) => [p.id as string, p.name as string]));
    },
    enabled: isPlatformAdmin,
    staleTime: 10 * 60_000,
  });

  const metrics: BillingMetrics | undefined = overview.data
    ? {
        mrr: overview.data.totals.mrr_net,
        arr: overview.data.totals.mrr_net * 12,
        payingCustomers: overview.data.totals.paying_customers,
        paidGross: overview.data.totals.paid_gross,
        paidGrossThisMonth: overview.data.totals.paid_gross_this_month,
        openGross: overview.data.totals.open_gross,
        openCount: overview.data.totals.open_count,
        byPlan: overview.data.by_plan.map((p) => ({
          planId: p.plan_id ?? '-',
          planName: (p.plan_id && plans?.get(p.plan_id)) || p.plan_id || '-',
          count: p.count,
          mrr: p.mrr_net,
        })),
      }
    : undefined;

  // HISTORISCH archief (oude Stripe Billing + bevestigde bankbetalingen + AI-credits).
  // `amount` staat in euro (NUMERIC), nooit delen door 100.
  const { data: legacyInvoices } = useQuery({
    queryKey: ['platform-all-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_invoices')
        .select(`
          *,
          tenants (id, name)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data as (PlatformInvoice & { tenants: { id: string; name: string } })[];
    },
    enabled: isPlatformAdmin,
  });

  // Risico: gefactureerde tenants met een achterstallige status (past_due, restricted,
  // suspended) of een openstaand bedrag voorbij de vervaldatum.
  // Een open verzoek dat nog niet vervallen is (of een SEPA-betaling in verwerking) is geen risico.
  const today = new Date().toISOString().slice(0, 10);
  const atRiskTenants = (overview.data?.tenants ?? []).filter(
    (t) =>
      t.category === 'client' &&
      (['past_due', 'restricted', 'suspended', 'unpaid'].includes(t.status ?? '') ||
        (t.open_gross > 0 && (t.open_expired || (!!t.open_due_date && t.open_due_date < today)))),
  );

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
    metricsLoading: overview.isLoading,
    metricsError: overview.error as Error | null,
    documents: overview.data?.documents ?? [],
    tenantFigures: overview.data?.tenants ?? [],
    totals: overview.data?.totals,
    legacyInvoices: legacyInvoices ?? [],
    atRiskTenants,
    isLoading,
    giftMonth,
  };
}
