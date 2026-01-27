import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SellqoLegalPage {
  id: string;
  page_type: string;
  slug: string;
  title: string;
  content: string;
  version: number;
  effective_date: string | null;
  is_published: boolean;
  last_published_at: string | null;
  created_at: string;
  updated_at: string;
}

export const LEGAL_PAGE_TYPES = [
  { type: 'terms', label: 'Algemene Voorwaarden', slug: 'terms' },
  { type: 'privacy', label: 'Privacybeleid', slug: 'privacy' },
  { type: 'cookies', label: 'Cookiebeleid', slug: 'cookies' },
  { type: 'sla', label: 'Service Level Agreement', slug: 'sla' },
  { type: 'acceptable-use', label: 'Acceptable Use Policy', slug: 'acceptable-use' },
  { type: 'dpa', label: 'Data Processing Agreement', slug: 'dpa' },
];

export function useSellqoLegal() {
  const queryClient = useQueryClient();

  const { data: legalPages = [], isLoading } = useQuery({
    queryKey: ['sellqo-legal-pages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellqo_legal_pages')
        .select('*')
        .order('page_type');
      if (error) throw error;
      return data as SellqoLegalPage[];
    },
  });

  const updatePageMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SellqoLegalPage> & { id: string }) => {
      const { data, error } = await supabase
        .from('sellqo_legal_pages')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellqo-legal-pages'] });
      toast.success('Pagina bijgewerkt');
    },
    onError: (error: Error) => {
      toast.error(`Fout: ${error.message}`);
    },
  });

  const publishPageMutation = useMutation({
    mutationFn: async (id: string) => {
      const page = legalPages.find(p => p.id === id);
      if (!page) throw new Error('Pagina niet gevonden');
      
      const { data, error } = await supabase
        .from('sellqo_legal_pages')
        .update({
          is_published: true,
          version: page.version + 1,
          last_published_at: new Date().toISOString(),
          effective_date: new Date().toISOString().split('T')[0],
        } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellqo-legal-pages'] });
      toast.success('Pagina gepubliceerd');
    },
    onError: (error: Error) => {
      toast.error(`Fout: ${error.message}`);
    },
  });

  const unpublishPageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('sellqo_legal_pages')
        .update({ is_published: false } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellqo-legal-pages'] });
      toast.success('Pagina gedepubliceerd');
    },
    onError: (error: Error) => {
      toast.error(`Fout: ${error.message}`);
    },
  });

  const getPageBySlug = (slug: string) => {
    return legalPages.find(p => p.slug === slug);
  };

  const getPageByType = (type: string) => {
    return legalPages.find(p => p.page_type === type);
  };

  const getPublishedPages = () => {
    return legalPages.filter(p => p.is_published);
  };

  return {
    legalPages,
    isLoading,
    updatePage: updatePageMutation.mutateAsync,
    publishPage: publishPageMutation.mutateAsync,
    unpublishPage: unpublishPageMutation.mutateAsync,
    getPageBySlug,
    getPageByType,
    getPublishedPages,
    isUpdating: updatePageMutation.isPending,
    isPublishing: publishPageMutation.isPending,
  };
}

// Public hook for viewing legal pages (no auth required)
export function usePublicLegalPage(slug: string) {
  const { data: page, isLoading, error } = useQuery({
    queryKey: ['public-legal-page', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellqo_legal_pages')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();
      if (error) throw error;
      return data as SellqoLegalPage;
    },
    enabled: !!slug,
  });

  return { page, isLoading, error };
}
