// SOCIAL-5 — data voor de tab "Resultaten": geposte posts van de laatste 90 dagen met hun
// cijfers (social_posts.engagement_data) en de volgers per dag (social_account_stats).
// Alleen lezen, via de bestaande RLS (leden van de winkel).

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { followerGrowth, summarize, type FollowerPoint, type MeasuredPost } from '@/lib/social/results';

export function useSocialResults() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const posts = useQuery({
    queryKey: ['social-results', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_posts')
        .select('id, media_type, posted_at, post_text, image_urls, engagement_data, engagement_48h, content_tags')
        .eq('tenant_id', tenantId!)
        .eq('status', 'posted')
        .gte('posted_at', subDays(new Date(), 90).toISOString())
        .order('posted_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      // engagement_48h en content_tags (SOCIAL-6) staan nog niet in de gegenereerde types.
      const rows = (data ?? []) as unknown as MeasuredPost[];
      return rows.filter((p) => !!p.posted_at);
    },
  });

  const followers = useQuery({
    queryKey: ['social-account-stats', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      // social_account_stats staat nog niet in de gegenereerde types (SOCIAL-5).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('social_account_stats')
        .select('captured_on, followers_count')
        .eq('tenant_id', tenantId!)
        .eq('platform', 'instagram')
        .gte('captured_on', subDays(new Date(), 30).toISOString().slice(0, 10))
        .order('captured_on', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FollowerPoint[];
    },
  });

  const summary = useMemo(() => summarize(posts.data ?? []), [posts.data]);
  const growth = useMemo(() => followerGrowth(followers.data ?? []), [followers.data]);

  return {
    isLoading: posts.isLoading || followers.isLoading,
    postedCount: posts.data?.length ?? 0,
    summary,
    growth,
  };
}
