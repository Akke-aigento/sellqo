import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import type { SEOScore, SEOKeyword, SEOAnalysisResult, SEOIssue, SEOSuggestion } from '@/types/seo';

export function useSEO() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // Fetch tenant SEO score
  const { data: tenantScore, isLoading: isLoadingScore } = useQuery({
    queryKey: ['seo-score', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from('seo_scores')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('entity_type', 'tenant')
        .order('last_analyzed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        issues: (data.issues || []) as unknown as SEOIssue[],
        suggestions: (data.suggestions || []) as unknown as SEOSuggestion[],
      } as SEOScore;
    },
    enabled: !!tenantId,
  });

  // Fetch product + category SEO scores
  const { data: entityScores, isLoading: isLoadingEntities } = useQuery({
    queryKey: ['seo-entity-scores', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('seo_scores')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('entity_type', ['product', 'category'])
        .order('overall_score', { ascending: true, nullsFirst: true });
      
      if (error) throw error;
      return (data || []).map(d => ({
        ...d,
        issues: (d.issues || []) as unknown as SEOIssue[],
        suggestions: (d.suggestions || []) as unknown as SEOSuggestion[],
      })) as SEOScore[];
    },
    enabled: !!tenantId,
  });

  const productScores = entityScores?.filter(s => s.entity_type === 'product') || [];
  const categoryScores = entityScores?.filter(s => s.entity_type === 'category') || [];

  // Fetch SEO keywords
  const { data: keywords, isLoading: isLoadingKeywords } = useQuery({
    queryKey: ['seo-keywords', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('seo_keywords')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('is_primary', { ascending: false });
      
      if (error) throw error;
      return (data || []) as SEOKeyword[];
    },
    enabled: !!tenantId,
  });

  // Fetch analysis history
  const { data: history } = useQuery({
    queryKey: ['seo-history', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('seo_analysis_history')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('analyzed_at', { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Trigger AI SEO analysis
  const analyzeSeOMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      
      const { data, error } = await supabase.functions.invoke('ai-seo-analyzer', {
        body: { tenantId },
      });
      
      if (error) throw error;
      return data as SEOAnalysisResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seo-score'] });
      queryClient.invalidateQueries({ queryKey: ['seo-product-scores'] });
      queryClient.invalidateQueries({ queryKey: ['seo-history'] });
      toast.success(`SEO Analyse voltooid - Score: ${data.overall_score}/100`);
    },
    onError: (error: Error) => {
      if (error.message.includes('credits')) {
        toast.error('Onvoldoende AI credits', {
          description: 'Koop extra credits om de analyse uit te voeren.',
        });
      } else {
        toast.error('Analyse mislukt', { description: error.message });
      }
    },
  });

  // Generate SEO content
  const generateContentMutation = useMutation({
    mutationFn: async (params: {
      type: 'meta_title' | 'meta_description' | 'product_description' | 'alt_text';
      productIds: string[];
    }) => {
      if (!tenantId) throw new Error('No tenant');
      
      const { data, error } = await supabase.functions.invoke('ai-generate-seo-content', {
        body: { tenantId, ...params },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.generated} items gegenereerd`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: Error) => {
      toast.error('Genereren mislukt', { description: error.message });
    },
  });

  // Add keyword
  const addKeywordMutation = useMutation({
    mutationFn: async (keyword: Omit<SEOKeyword, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error('No tenant');
      
      const { data, error } = await supabase
        .from('seo_keywords')
        .insert([{ 
          ...keyword, 
          tenant_id: tenantId,
          language: keyword.language || 'nl',
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-keywords'] });
      toast.success('Keyword toegevoegd');
    },
    onError: (error: Error) => {
      toast.error('Keyword toevoegen mislukt', { description: error.message });
    },
  });

  // Delete keyword
  const deleteKeywordMutation = useMutation({
    mutationFn: async (keywordId: string) => {
      const { error } = await supabase
        .from('seo_keywords')
        .delete()
        .eq('id', keywordId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-keywords'] });
      toast.success('Keyword verwijderd');
    },
  });

  // Generate sitemap
  const generateSitemapMutation = useMutation({
    mutationFn: async (baseUrl: string) => {
      if (!tenantId) throw new Error('No tenant');
      
      const { data, error } = await supabase.functions.invoke('generate-sitemap', {
        body: { tenantId, baseUrl },
      });
      
      if (error) throw error;
      return data as {
        sitemap: string;
        imageSitemap: string;
        sitemapIndex: string;
        stats: { totalUrls: number; products: number; categories: number; productsWithImages: number };
      };
    },
    onSuccess: (data) => {
      toast.success(`Sitemap gegenereerd met ${data.stats.totalUrls} URLs`);
    },
    onError: (error: Error) => {
      toast.error('Sitemap genereren mislukt', { description: error.message });
    },
  });

  // Calculate quick wins from issues
  const quickWins = tenantScore?.issues
    ?.filter((issue: SEOIssue) => issue.severity === 'warning' || issue.severity === 'error')
    .slice(0, 5) || [];

  // Calculate products needing attention
  const productsNeedingAttention = productScores?.filter(
    (score) => score.overall_score !== null && score.overall_score < 50
  ).length || 0;

  return {
    tenantScore,
    productScores,
    keywords,
    history,
    quickWins,
    productsNeedingAttention,
    isLoading: isLoadingScore || isLoadingProducts || isLoadingKeywords,
    analyzeSEO: analyzeSeOMutation.mutate,
    isAnalyzing: analyzeSeOMutation.isPending,
    generateContent: generateContentMutation.mutate,
    isGenerating: generateContentMutation.isPending,
    addKeyword: addKeywordMutation.mutate,
    deleteKeyword: deleteKeywordMutation.mutate,
    generateSitemap: generateSitemapMutation.mutateAsync,
    isGeneratingSitemap: generateSitemapMutation.isPending,
  };
}
