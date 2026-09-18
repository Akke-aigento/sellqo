import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import type { AIAssistantConfig, KnowledgeStats } from '@/types/ai-assistant';
import { resolveAIConfig, isPersistedConfig } from '@/lib/aiAssistantConfig';

export function useAIAssistant() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['ai-assistant-config', currentTenant?.id],
    queryFn: async (): Promise<AIAssistantConfig | null> => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('ai_assistant_config' as any)
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      // APP-INBOX-CRASH-1: ontbrekend of onleesbaar = defaults in het geheugen.
      // Hier stond een INSERT; een leespad schrijft niet (zie resolveAIConfig).
      if (error) console.warn('AI assistant config niet leesbaar, defaults gebruikt:', error);
      return resolveAIConfig(currentTenant.id, data as unknown as AIAssistantConfig | null, error);
    },
    enabled: !!currentTenant?.id,
    retry: false,
  });

  const { data: knowledgeStats } = useQuery({
    queryKey: ['ai-knowledge-stats', currentTenant?.id],
    queryFn: async (): Promise<KnowledgeStats> => {
      if (!currentTenant?.id) {
        return { products: 0, categories: 0, pages: 0, legal: 0, shipping: 0, custom: 0, lastUpdated: null };
      }

      const { data, error } = await supabase
        .from('ai_knowledge_index' as any)
        .select('source_type, updated_at')
        .eq('tenant_id', currentTenant.id);

      if (error) {
        console.error('Error fetching knowledge stats:', error);
        return { products: 0, categories: 0, pages: 0, legal: 0, shipping: 0, custom: 0, lastUpdated: null };
      }

      const stats: KnowledgeStats = {
        products: 0,
        categories: 0,
        pages: 0,
        legal: 0,
        shipping: 0,
        custom: 0,
        lastUpdated: null,
      };

      let latestDate: Date | null = null;

      (data as any[])?.forEach((item) => {
        const type = item.source_type as string;
        if (type === 'products') stats.products++;
        else if (type === 'categories') stats.categories++;
        else if (type === 'pages') stats.pages++;
        else if (type === 'legal') stats.legal++;
        else if (type === 'shipping') stats.shipping++;
        else if (type === 'custom') stats.custom++;
        const itemDate = new Date(item.updated_at);
        if (!latestDate || itemDate > latestDate) {
          latestDate = itemDate;
        }
      });

      stats.lastUpdated = latestDate ? latestDate.toISOString() : null;

      return stats;
    },
    enabled: !!currentTenant?.id,
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: Partial<AIAssistantConfig>) => {
      if (!currentTenant?.id || !config) {
        throw new Error('No tenant or config');
      }

      // Bestaat de rij nog niet, dan ontstaat hij hier — na een klik op
      // Opslaan, nooit tijdens het lezen.
      const { error } = isPersistedConfig(config)
        ? await supabase
            .from('ai_assistant_config' as any)
            .update(updates)
            .eq('id', config.id)
        : await supabase
            .from('ai_assistant_config' as any)
            .upsert({ ...updates, tenant_id: currentTenant.id }, { onConflict: 'tenant_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-assistant-config', currentTenant?.id] });
      toast({
        title: 'Instellingen opgeslagen',
        description: 'Je AI assistent instellingen zijn bijgewerkt.',
      });
    },
    onError: (error) => {
      console.error('Error updating AI config:', error);
      toast({
        title: 'Fout bij opslaan',
        description: 'Er is iets misgegaan bij het opslaan.',
        variant: 'destructive',
      });
    },
  });

  const rebuildIndex = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { error } = await supabase.functions.invoke('ai-build-knowledge-index', {
        body: { tenant_id: currentTenant.id },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-knowledge-stats', currentTenant?.id] });
      toast({
        title: 'Index wordt vernieuwd',
        description: 'De AI kennisbank wordt op de achtergrond bijgewerkt.',
      });
    },
    onError: (error) => {
      console.error('Error rebuilding index:', error);
      toast({
        title: 'Fout bij vernieuwen',
        description: 'Er is iets misgegaan bij het vernieuwen van de index.',
        variant: 'destructive',
      });
    },
  });

  return {
    config,
    isLoading,
    knowledgeStats,
    updateConfig: updateConfig.mutate,
    isUpdating: updateConfig.isPending,
    rebuildIndex: rebuildIndex.mutate,
    isRebuilding: rebuildIndex.isPending,
  };
}
