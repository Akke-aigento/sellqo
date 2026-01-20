import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

interface AICredits {
  id: string;
  tenant_id: string;
  credits_total: number;
  credits_used: number;
  credits_purchased: number;
  credits_reset_at: string | null;
  available: number;
}

export function useAICredits() {
  const { currentTenant } = useTenant();

  const { data: credits, isLoading, refetch } = useQuery({
    queryKey: ['ai-credits', currentTenant?.id],
    queryFn: async (): Promise<AICredits | null> => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('tenant_ai_credits')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching AI credits:', error);
        return null;
      }

      if (!data) {
        // Return default values if no credits record exists
        return {
          id: '',
          tenant_id: currentTenant.id,
          credits_total: 0,
          credits_used: 0,
          credits_purchased: 0,
          credits_reset_at: null,
          available: 0,
        };
      }

      return {
        ...data,
        available: data.credits_total + data.credits_purchased - data.credits_used,
      };
    },
    enabled: !!currentTenant?.id,
  });

  const { data: usageHistory } = useQuery({
    queryKey: ['ai-usage-history', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('ai_usage_log')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching AI usage:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  const hasCredits = (required: number) => {
    return (credits?.available || 0) >= required;
  };

  const getCreditCost = (feature: string): number => {
    const costs: Record<string, number> = {
      insights: 1,
      social_post: 2,
      email_content: 3,
      image_generation: 5,
      image_enhancement: 2,
      campaign_suggestion: 1,
    };
    return costs[feature] || 1;
  };

  return {
    credits,
    usageHistory,
    isLoading,
    refetch,
    hasCredits,
    getCreditCost,
  };
}
