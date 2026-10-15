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
  | 'manual'
  | 'regenerate_requested';

/** SOCIAL-3: muziekvoorstel bij een reel. Alle velden optioneel: de weektaak vult in wat past. */
export interface SongSuggestion {
  title: string;
  artist?: string;
  /** Waarom dit nummer past, of vanaf waar het moet starten. */
  note?: string;
}

export interface MusicHint {
  /** SOCIAL-3b: concrete nummers om in de Instagram-app te zoeken. */
  songs?: SongSuggestion[];
  mood?: string;
  bpm?: number;
  search_terms?: string[];
  tip?: string;
  track?: { title?: string; source?: string; license?: string };
}

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
  video_url: string | null;
  video_silent_url: string | null;
  music_hint: MusicHint | null;
  manual_reason: string | null;
  regenerate_note: string | null;
  language: string | null;
  /** SOCIAL-4: per beeld een recept (of null), parallel aan image_urls. */
  image_recipes: unknown[] | null;
}

/** SOCIAL-3: een reel kan enkel automatisch als er een versie met muziek is. */
export function canAutoApprove(post: Pick<PlannerPost, 'status' | 'media_type' | 'video_url'>): boolean {
  if (post.status !== 'pending_approval' && post.status !== 'draft') return false;
  return post.media_type !== 'reel' || !!post.video_url;
}

/**
 * SOCIAL-3: "Opnieuw maken" bestaat enkel voor posts van de contentpijplijn (source
 * content_task): daar draait een taak die verzoeken oppikt. Bij eigen posts zou de knop
 * niets doen.
 */
export function canRegenerate(post: Pick<PlannerPost, 'status' | 'source'>): boolean {
  return post.source === 'content_task'
    && ['pending_approval', 'draft', 'approved', 'scheduled', 'manual', 'failed'].includes(post.status);
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
        .select('id, platform, post_text, image_urls, media_type, scheduled_for, posted_at, status, error_message, source, publish_attempts, video_url, video_silent_url, music_hint, manual_reason, regenerate_note, language, image_recipes')
        .eq('tenant_id', tenantId!)
        .or(`scheduled_for.gte.${since},status.in.(pending_approval,failed,manual,regenerate_requested)`)
        .order('scheduled_for', { ascending: true, nullsFirst: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as PlannerPost[];
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
        pendingIds: list.filter(canAutoApprove).map((p) => p.id),
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
        // SOCIAL-3: een reel zonder versie met muziek kan niet automatisch.
        .or('media_type.neq.reel,video_url.not.is.null')
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

  /** SOCIAL-3: reel zelf posten met eigen muziek in de Instagram-app. */
  const chooseOwnMusic = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('social_posts')
        .update({ status: 'manual', manual_reason: 'music', reminded_at: null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('media_type', 'reel')
        .in('status', ['pending_approval', 'draft', 'approved', 'scheduled']);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** SOCIAL-3: nieuwe versie vragen; de contenttaak pikt het verzoek op. */
  const requestRegenerate = useMutation({
    mutationFn: async (input: { post: PlannerPost; note: string; language?: string | null }) => {
      const { error } = await supabase
        .from('social_posts')
        .update({
          status: 'regenerate_requested',
          regenerate_from: input.post.status,
          regenerate_note: input.note.trim() || null,
          regenerate_language: input.language ?? null,
          regenerate_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.post.id)
        .eq('source', 'content_task')
        .in('status', ['pending_approval', 'draft', 'approved', 'scheduled', 'manual', 'failed']);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /**
   * SOCIAL-4: nieuw beeld na "Tekst in beeld aanpassen". De JPEG is in de browser gemaakt;
   * hier gaat hij naar de eigen tenantmap van marketing-assets en vervangt hij dat ene beeld.
   * De status blijft wat hij was (zoals bij het aanpassen van de tekst).
   */
  const saveImageText = useMutation({
    mutationFn: async (input: { post: PlannerPost; index: number; jpeg: Blob; recipe: Record<string, unknown> }) => {
      if (!tenantId) throw new Error('Geen winkel geselecteerd.');
      const path = `${tenantId}/social/edit-${input.post.id}-${input.index}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('marketing-assets')
        .upload(path, input.jpeg, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
      if (uploadError) throw uploadError;
      const url = supabase.storage.from('marketing-assets').getPublicUrl(path).data.publicUrl;

      const urls = [...(input.post.image_urls ?? [])];
      const recipes = [...(input.post.image_recipes ?? [])];
      while (recipes.length < urls.length) recipes.push(null);
      urls[input.index] = url;
      recipes[input.index] = input.recipe;
      const { data, error } = await supabase
        .from('social_posts')
        .update({ image_urls: urls, image_recipes: recipes as never, updated_at: new Date().toISOString() })
        .eq('id', input.post.id)
        .not('status', 'in', '(posted,publishing)')
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Deze post kan niet meer aangepast worden.');
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

  return { posts, weeks, pendingCount, isLoading, approve, update, remove, markPosted, chooseOwnMusic, requestRegenerate, saveImageText };
}
