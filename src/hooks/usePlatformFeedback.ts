import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AppFeedback {
  id: string;
  tenant_id: string;
  user_id: string | null;
  rating: number | null;
  is_satisfied: boolean | null;
  feedback_text: string | null;
  feature_requests: string | null;
  milestone_id: string | null;
  created_at: string;
  tenant?: { name: string; slug: string } | null;
}

export function usePlatformFeedback() {
  const { data: feedback = [], isLoading } = useQuery({
    queryKey: ['platform-feedback'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_feedback')
        .select(`
          *,
          tenant:tenants(name, slug)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AppFeedback[];
    },
  });

  const getStats = () => {
    const withRating = feedback.filter(f => f.rating !== null);
    const averageRating = withRating.length > 0 
      ? withRating.reduce((sum, f) => sum + (f.rating || 0), 0) / withRating.length 
      : 0;
    
    const satisfied = feedback.filter(f => f.is_satisfied === true).length;
    const dissatisfied = feedback.filter(f => f.is_satisfied === false).length;
    const withFeatureRequests = feedback.filter(f => f.feature_requests).length;
    
    // Calculate NPS (simplified)
    const promoters = feedback.filter(f => (f.rating || 0) >= 4).length;
    const detractors = feedback.filter(f => (f.rating || 0) <= 2).length;
    const nps = withRating.length > 0 
      ? Math.round(((promoters - detractors) / withRating.length) * 100)
      : 0;
    
    return {
      total: feedback.length,
      averageRating: Math.round(averageRating * 10) / 10,
      nps,
      satisfied,
      dissatisfied,
      withFeatureRequests,
    };
  };

  const getRatingDistribution = () => {
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedback.forEach(f => {
      if (f.rating && f.rating >= 1 && f.rating <= 5) {
        distribution[f.rating]++;
      }
    });
    return distribution;
  };

  const getFeatureRequests = () => {
    return feedback
      .filter(f => f.feature_requests)
      .map(f => ({
        id: f.id,
        request: f.feature_requests!,
        tenant: f.tenant?.name || 'Onbekend',
        created_at: f.created_at,
      }));
  };

  const getFeedbackByTenant = () => {
    const byTenant: Record<string, AppFeedback[]> = {};
    feedback.forEach(f => {
      const tenantName = f.tenant?.name || 'Onbekend';
      if (!byTenant[tenantName]) byTenant[tenantName] = [];
      byTenant[tenantName].push(f);
    });
    return byTenant;
  };

  return {
    feedback,
    isLoading,
    getStats,
    getRatingDistribution,
    getFeatureRequests,
    getFeedbackByTenant,
  };
}
