import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export interface SEOKeyword {
  id: string;
  keyword: string;
  is_primary: boolean;
  intent: string | null;
  search_volume_estimate: string | null;
}

export function useSEOKeywords() {
  const { currentTenant } = useTenant();

  const { data: keywords = [], isLoading } = useQuery({
    queryKey: ['seo-keywords', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('seo_keywords')
        .select('id, keyword, is_primary, intent, search_volume_estimate')
        .eq('tenant_id', currentTenant.id)
        .eq('is_primary', true)
        .limit(10);

      if (error) {
        console.error('Error fetching SEO keywords:', error);
        return [];
      }

      return data as SEOKeyword[];
    },
    enabled: !!currentTenant?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Extract just the keyword strings for quick scoring
  const primaryKeywords = keywords.map(k => k.keyword);

  return {
    keywords,
    primaryKeywords,
    isLoading,
  };
}
