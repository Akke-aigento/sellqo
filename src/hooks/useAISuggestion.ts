import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import { useAICredits } from './useAICredits';

interface SuggestionParams {
  conversationId: string;
  messageId?: string;
  customerMessage: string;
  customerName?: string;
  channel: 'email' | 'whatsapp';
  forceRegenerate?: boolean;
  context?: {
    orderId?: string;
    orderNumber?: string;
    subject?: string;
  };
}

interface CachedSuggestion {
  suggestion: string;
  cached: boolean;
  cachedAt?: string;
}

export function useAISuggestion() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { hasCredits, refetch: refetchCredits } = useAICredits();
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);

  const fetchSuggestion = useCallback(async (params: SuggestionParams) => {
    if (!currentTenant?.id) return;

    // Only check credits if forcing regeneration or no cache expected
    if (params.forceRegenerate && !hasCredits(1)) {
      toast({
        title: 'Onvoldoende AI credits',
        description: 'Je hebt geen AI credits meer. Koop extra credits om door te gaan.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setSuggestion(null);
    setIsCached(false);

    try {
      const { data, error } = await supabase.functions.invoke('ai-suggest-reply', {
        body: {
          tenant_id: currentTenant.id,
          conversation_id: params.conversationId,
          message_id: params.messageId,
          customer_message: params.customerMessage,
          customer_name: params.customerName,
          channel: params.channel,
          force_regenerate: params.forceRegenerate,
          context: params.context,
        },
      });

      if (error) throw error;

      if (data?.suggestion) {
        setSuggestion(data.suggestion);
        setIsCached(data.cached === true);
        
        // Only refetch credits if a new suggestion was generated (not cached)
        if (!data.cached) {
          refetchCredits();
        }
      }
    } catch (error) {
      console.error('Error fetching AI suggestion:', error);
      toast({
        title: 'Suggestie kon niet worden geladen',
        description: 'Er is iets misgegaan bij het genereren van de AI suggestie.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, hasCredits, refetchCredits, toast]);

  const loadCachedSuggestion = useCallback(async (
    messageId: string
  ): Promise<CachedSuggestion | null> => {
    if (!currentTenant?.id || !messageId) return null;

    try {
      const { data, error } = await supabase
        .from('ai_reply_suggestions')
        .select('suggestion_text, created_at')
        .eq('tenant_id', currentTenant.id)
        .eq('message_id', messageId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSuggestion(data.suggestion_text);
        setIsCached(true);
        return {
          suggestion: data.suggestion_text,
          cached: true,
          cachedAt: data.created_at,
        };
      }
    } catch (error) {
      console.error('Error loading cached suggestion:', error);
    }

    return null;
  }, [currentTenant?.id]);

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
    setIsCached(false);
  }, []);

  return {
    suggestion,
    isLoading,
    isCached,
    fetchSuggestion,
    loadCachedSuggestion,
    clearSuggestion,
  };
}
