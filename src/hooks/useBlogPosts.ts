import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  category: string;
  author: string;
  status: 'draft' | 'published';
  published_at: string | null;
  reading_minutes: number | null;
  meta_title: string | null;
  meta_description: string | null;
  translations: Record<string, Partial<Record<BlogTranslatableField, string>>> | null;
  created_at: string;
  updated_at: string;
}

export type BlogTranslatableField =
  | 'title'
  | 'excerpt'
  | 'content'
  | 'meta_title'
  | 'meta_description';

const LIST_COLUMNS =
  'id, slug, title, excerpt, cover_image_url, category, author, status, published_at, reading_minutes, meta_title, meta_description, translations, created_at, updated_at';

/**
 * Taalgevoelige resolve: actieve websitetaal uit `translations`, met de
 * NL-kolomwaarde als fallback wanneer een taalveld ontbreekt.
 */
export function resolveBlogField(
  post: Pick<BlogPost, 'translations'> & Partial<Record<BlogTranslatableField, string | null>>,
  field: BlogTranslatableField,
  lang: string,
): string | null {
  const base = (lang || 'nl').split('-')[0];
  const translated = post.translations?.[base]?.[field];
  if (translated && translated.trim().length > 0) return translated;
  return (post[field] as string | null | undefined) ?? null;
}

export function useBlogLanguage(): string {
  const { i18n } = useTranslation();
  return (i18n.language || 'nl').split('-')[0];
}

/** Publieke lijst — RLS geeft anon enkel gepubliceerde artikelen terug. */
export function usePublicBlogPosts() {
  return useQuery({
    queryKey: ['blog-posts', 'public'],
    queryFn: async (): Promise<BlogPost[]> => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select(LIST_COLUMNS)
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BlogPost[];
    },
  });
}

/**
 * Detail op slug. Geen frontend-guard op status: RLS bepaalt of er een rij
 * terugkomt (drafts enkel voor platform-admins → anon krijgt 404).
 */
export function useBlogPost(slug: string | undefined) {
  return useQuery({
    queryKey: ['blog-posts', 'detail', slug],
    enabled: !!slug,
    queryFn: async (): Promise<BlogPost | null> => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as BlogPost) ?? null;
    },
  });
}

/** Admin-variant: alle posts incl. drafts (platform-admin RLS-policy). */
export function useAdminBlogPosts() {
  return useQuery({
    queryKey: ['blog-posts', 'admin'],
    queryFn: async (): Promise<BlogPost[]> => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select(LIST_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BlogPost[];
    },
  });
}

/** Leestijd: woorden / 200, minimaal 1 minuut. */
export function estimateReadingMinutes(html: string | null | undefined): number {
  const text = (html ?? '').replace(/<[^>]*>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
