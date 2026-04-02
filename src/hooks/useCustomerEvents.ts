import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useMemo } from 'react';

export interface CustomerEvent {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  page_url: string | null;
  session_id: string | null;
  created_at: string;
}

export interface EngagementSummary {
  totalSessions: number;
  totalPageViews: number;
  totalProductViews: number;
  totalCartAdds: number;
  totalEmailOpens: number;
  totalEmailClicks: number;
  avgTimeOnSite: number; // seconds
  engagementScore: number;
}

const SCORE_WEIGHTS: Record<string, number> = {
  page_view: 1,
  product_view: 2,
  add_to_cart: 5,
  remove_from_cart: 0,
  checkout_start: 8,
  search: 2,
  wishlist_add: 3,
  email_open: 3,
  email_click: 5,
  purchase: 20,
};

export function useCustomerEvents(customerId?: string, storefrontCustomerId?: string) {
  const { currentTenant } = useTenant();

  const eventsQuery = useQuery({
    queryKey: ['customer-events', currentTenant?.id, customerId, storefrontCustomerId],
    queryFn: async (): Promise<CustomerEvent[]> => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('customer_events')
        .select('id, event_type, event_data, page_url, session_id, created_at')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      } else if (storefrontCustomerId) {
        query = query.eq('storefront_customer_id', storefrontCustomerId);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CustomerEvent[];
    },
    enabled: !!currentTenant?.id && !!(customerId || storefrontCustomerId),
  });

  const engagement = useMemo((): EngagementSummary => {
    const events = eventsQuery.data || [];
    const sessions = new Set(events.map(e => e.session_id).filter(Boolean));
    
    const counts: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;

    events.forEach(e => {
      counts[e.event_type] = (counts[e.event_type] || 0) + 1;
      const dur = e.event_data?.duration_seconds;
      if (typeof dur === 'number' && dur > 0) {
        totalDuration += dur;
        durationCount++;
      }
    });

    // Calculate weighted score with recency bonus
    const now = Date.now();
    let score = 0;
    events.forEach(e => {
      const weight = SCORE_WEIGHTS[e.event_type] || 1;
      const ageMs = now - new Date(e.created_at).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const recencyMultiplier = ageDays < 7 ? 1.5 : ageDays < 30 ? 1.0 : 0.5;
      score += weight * recencyMultiplier;
    });

    return {
      totalSessions: sessions.size,
      totalPageViews: counts['page_view'] || 0,
      totalProductViews: counts['product_view'] || 0,
      totalCartAdds: counts['add_to_cart'] || 0,
      totalEmailOpens: counts['email_open'] || 0,
      totalEmailClicks: counts['email_click'] || 0,
      avgTimeOnSite: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
      engagementScore: Math.round(score),
    };
  }, [eventsQuery.data]);

  return {
    events: eventsQuery.data || [],
    engagement,
    isLoading: eventsQuery.isLoading,
  };
}
