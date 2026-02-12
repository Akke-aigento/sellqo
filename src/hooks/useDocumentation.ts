import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type DocLevel = 'tenant' | 'platform';

export interface DocCategory {
  id: string;
  doc_level: DocLevel;
  title: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocArticle {
  id: string;
  category_id: string;
  doc_level: DocLevel;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  tags: string[];
  context_path: string | null;
  sort_order: number;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useDocCategories(level: DocLevel) {
  return useQuery({
    queryKey: ['doc-categories', level],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doc_categories')
        .select('*')
        .eq('doc_level', level)
        .order('sort_order');
      if (error) throw error;
      return data as DocCategory[];
    },
  });
}

export function useDocArticles(level: DocLevel, categoryId?: string) {
  return useQuery({
    queryKey: ['doc-articles', level, categoryId],
    queryFn: async () => {
      let q = supabase
        .from('doc_articles')
        .select('*')
        .eq('doc_level', level)
        .order('sort_order');
      if (categoryId) q = q.eq('category_id', categoryId);
      const { data, error } = await q;
      if (error) throw error;
      return data as DocArticle[];
    },
  });
}

export function useDocArticleBySlug(level: DocLevel, slug: string | undefined) {
  return useQuery({
    queryKey: ['doc-article', level, slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('doc_articles')
        .select('*')
        .eq('doc_level', level)
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return data as DocArticle | null;
    },
    enabled: !!slug,
  });
}

export function useDocSearch(level: DocLevel, query: string) {
  return useQuery({
    queryKey: ['doc-search', level, query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const searchTerm = `%${query}%`;
      const { data, error } = await supabase
        .from('doc_articles')
        .select('*')
        .eq('doc_level', level)
        .or(`title.ilike.${searchTerm},excerpt.ilike.${searchTerm}`)
        .order('sort_order');
      if (error) throw error;
      return data as DocArticle[];
    },
    enabled: query.length >= 2,
  });
}

export function useSaveArticle() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (article: Partial<DocArticle> & { id?: string }) => {
      if (article.id) {
        const { data, error } = await supabase
          .from('doc_articles')
          .update({
            title: article.title,
            slug: article.slug,
            content: article.content,
            excerpt: article.excerpt,
            tags: article.tags,
            context_path: article.context_path,
            is_published: article.is_published,
            category_id: article.category_id,
          })
          .eq('id', article.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('doc_articles')
          .insert({
            ...article,
            created_by: user?.id,
          } as any)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-articles'] });
      qc.invalidateQueries({ queryKey: ['doc-article'] });
      qc.invalidateQueries({ queryKey: ['doc-search'] });
    },
  });
}

export function useDeleteArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('doc_articles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-articles'] });
    },
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: Partial<DocCategory> & { id?: string }) => {
      if (cat.id) {
        const { data, error } = await supabase
          .from('doc_categories')
          .update({ title: cat.title, slug: cat.slug, description: cat.description, icon: cat.icon })
          .eq('id', cat.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('doc_categories')
          .insert(cat as any)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-categories'] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('doc_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-categories'] });
      qc.invalidateQueries({ queryKey: ['doc-articles'] });
    },
  });
}
