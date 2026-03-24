import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export interface CustomerHealthScore {
  id: string;
  name: string;
  email: string;
  score: number; // 0-100
  trend: 'up' | 'down' | 'stable';
  factors: {
    recency: number;
    frequency: number;
    engagement: number;
    loyalty: number;
  };
}

function calculateHealthScore(
  daysSinceLastOrder: number | null,
  totalOrders: number,
  emailEngagement: number | null,
  totalSpent: number,
): { score: number; factors: CustomerHealthScore['factors'] } {
  // Recency (0-25): more recent = higher
  let recency = 25;
  if (daysSinceLastOrder === null) recency = 0;
  else if (daysSinceLastOrder > 180) recency = 0;
  else if (daysSinceLastOrder > 90) recency = 5;
  else if (daysSinceLastOrder > 60) recency = 10;
  else if (daysSinceLastOrder > 30) recency = 18;
  else recency = 25;

  // Frequency (0-25): more orders = higher
  let frequency = Math.min(25, Math.round((totalOrders / 10) * 25));

  // Engagement (0-25): email engagement score
  let engagement = Math.round(((emailEngagement ?? 50) / 100) * 25);

  // Loyalty/value (0-25): based on total spent
  let loyalty = Math.min(25, Math.round((totalSpent / 1000) * 25));

  return {
    score: recency + frequency + engagement + loyalty,
    factors: { recency, frequency, engagement, loyalty },
  };
}

export function useCustomerHealthScores(limit = 10) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['customer-health-scores', currentTenant?.id, limit],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, total_orders, total_spent, email_engagement_score')
        .eq('tenant_id', currentTenant.id)
        .gt('total_orders', 0)
        .order('total_spent', { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!customers) return [];

      // Get latest order dates
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('customer_id, created_at')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      const latestOrderMap = new Map<string, number>();
      const now = Date.now();
      for (const o of recentOrders ?? []) {
        if (o.customer_id && !latestOrderMap.has(o.customer_id)) {
          latestOrderMap.set(o.customer_id, Math.floor((now - new Date(o.created_at).getTime()) / 86400000));
        }
      }

      const scored: CustomerHealthScore[] = customers.map(c => {
        const daysSince = latestOrderMap.get(c.id) ?? null;
        const { score, factors } = calculateHealthScore(
          daysSince,
          c.total_orders ?? 0,
          c.email_engagement_score,
          Number(c.total_spent ?? 0),
        );
        return {
          id: c.id,
          name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Onbekend',
          email: c.email ?? '',
          score,
          trend: score >= 60 ? 'up' : score >= 30 ? 'stable' : 'down',
          factors,
        };
      });

      // Sort by score ascending (worst first) and return the ones needing attention
      scored.sort((a, b) => a.score - b.score);
      return scored.slice(0, limit);
    },
    enabled: !!currentTenant?.id,
  });
}
