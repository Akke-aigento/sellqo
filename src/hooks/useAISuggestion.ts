import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import { useAICredits } from './useAICredits';

interface SuggestionParams {
  conversationId: string;
  customerMessage: string;
  customerName?: string;
  channel: 'email' | 'whatsapp';
  context?: {
    orderId?: string;
    orderNumber?: string;
    subject?: string;
  };
}

export function useAISuggestion() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { hasCredits, refetch: refetchCredits } = useAICredits();
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSuggestion = async (params: SuggestionParams) => {
    if (!currentTenant?.id) return;

    // Check credits
    if (!hasCredits(1)) {
      toast({
        title: 'Onvoldoende AI credits',
        description: 'Je hebt geen AI credits meer. Koop extra credits om door te gaan.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setSuggestion(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-suggest-reply', {
        body: {
          tenant_id: currentTenant.id,
          conversation_id: params.conversationId,
          customer_message: params.customerMessage,
          customer_name: params.customerName,
          channel: params.channel,
          context: params.context,
        },
      });

      if (error) throw error;

      if (data?.suggestion) {
        setSuggestion(data.suggestion);
        refetchCredits();
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
  };

  const clearSuggestion = () => {
    setSuggestion(null);
  };

  return {
    suggestion,
    isLoading,
    fetchSuggestion,
    clearSuggestion,
  };
}
