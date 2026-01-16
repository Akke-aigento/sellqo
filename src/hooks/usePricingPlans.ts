import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PricingPlan, PricingPlanFeatures } from '@/types/billing';

export function usePricingPlans() {
  const { data: plans, isLoading, error } = useQuery({
    queryKey: ['pricing-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      return (data || []).map(plan => ({
        ...plan,
        features: plan.features as unknown as PricingPlanFeatures
      })) as PricingPlan[];
    },
  });

  return {
    plans: plans ?? [],
    isLoading,
    error,
  };
}

export function usePricingPlan(planId: string | undefined) {
  const { data: plan, isLoading, error } = useQuery({
    queryKey: ['pricing-plan', planId],
    queryFn: async () => {
      if (!planId) return null;
      
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        features: data.features as unknown as PricingPlanFeatures
      } as PricingPlan;
    },
    enabled: !!planId,
  });

  return { plan, isLoading, error };
}
