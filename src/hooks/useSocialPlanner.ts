// SOCIAL-2 — data voor de Social planning: posts ophalen, goedkeuren, aanpassen, schrappen.
//
// Alles gaat rechtstreeks via de bestaande RLS op social_posts
// (social_posts_update_marketing / social_posts_delete_marketing: tenant_admin, staff,
// marketing). Publiceren zelf doet de scheduler (social-publish-due), elk uur op :01.

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfWeek, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';

export type PlannerStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'posted'
  | 'failed'
  | 'manual';

export interface PlannerPost {
  id: string;
  platform: string;
  post_text: string;
  image_urls: string[] | null;
  media_type: string;
  scheduled_for: string | null;
  posted_at: string | null;
  status: PlannerStatus;
  error_message: string | null;
  source: string | null;
  publish_attempts: number;
}

export interface PlannerWeek {
  /** Maandag van de week, ISO-datum. */
  weekStart: string;
  posts: PlannerPost[];
  pendingIds: string[];
}

const QUERY_KEY = 'social-planner';

export function useSocialPlanner() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const { data: posts = [], isLoading } = useQuery({
    queryKey: [QUERY_KEY, tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      // Alles vanaf vorige week, plus wat nog aandacht vraagt (ook als het ouder is).
      const since = subDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7).toISOString();
      const { data, error } = await supabase
        .from('social_posts')
        .select('id, platform, post_text, image_urls, media_type, scheduled_for, posted_at, status, error_message, source, publish_attempts')
        .eq('tenant_id', tenantId!)
        .or(`scheduled_for.gte.${since},status.in.(pending_approval,failed,manual)`)
        .order('scheduled_for', { ascending: true, nullsFirst: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as PlannerPost[];
    },
  });

  const weeks: PlannerWeek[] = useMemo(() => {
    const map = new Map<string, PlannerPost[]>();
    for (const post of posts) {
      const when = post.scheduled_for ? new Date(post.scheduled_for) : new Date();
      const key = startOfWeek(when, { weekStartsOn: 1 }).toISOString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(post);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, list]) => ({
        weekStart,
        posts: list,
        pendingIds: list.filter((p) => p.status === 'pending_approval' || p.status === 'draft').map((p) => p.id),
      }));
  }, [posts]);

  const pendingCount = useMemo(
    () => posts.filter((p) => p.status === 'pending_approval').length,
    [posts],
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });

  /** Keurt posts goed. Enkel concepten en wachtende posts; de rest blijft ongemoeid. */
  const approve = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return 0;
      const { data, error } = await supabase
        .from('social_posts')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .in('id', ids)
        .in('status', ['pending_approval', 'draft'])
        .select('id');
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: invalidate,
  });

  /**
   * Tekst en/of tijdstip aanpassen. Een mislukte post die opnieuw ingepland wordt,
   * gaat terug naar 'approved' met een schone teller, zodat de scheduler hem weer oppikt.
   */
  const update = useMutation({
    mutationFn: async (input: { post: PlannerPost; text: string; scheduledFor: string }) => {
      const now = new Date().toISOString();
      const changes = input.post.status === 'failed'
        ? {
            post_text: input.text,
            scheduled_for: input.scheduledFor,
            updated_at: now,
            status: 'approved',
            publish_attempts: 0,
            error_message: null,
            approved_at: now,
            approved_by: user?.id ?? null,
          }
        : { post_text: input.text, scheduled_for: input.scheduledFor, updated_at: now };
      const { error } = await supabase.from('social_posts').update(changes).eq('id', input.post.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('social_posts')
        .delete()
        .eq('id', id)
        .not('status', 'in', '(posted,publishing)');
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Een post die je zelf geplaatst hebt (bv. story met sticker) afvinken. */
  const markPosted = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('social_posts')
        .update({ status: 'posted', posted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'manual');
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { posts, weeks, pendingCount, isLoading, approve, update, remove, markPosted };
}
