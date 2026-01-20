import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

interface MarketingContext {
  business: { name: string; currency: string; country: string };
  products: {
    total: number;
    active: number;
    lowStock: Array<{ id: string; name: string; stock: number; price: number; image?: string }>;
    bestsellers: Array<{ id: string; name: string; orderCount: number; revenue: number }>;
    newArrivals: Array<{ id: string; name: string; price: number; image?: string }>;
    featured: Array<{ id: string; name: string; price: number; image?: string }>;
    categories: Array<{ id: string; name: string; productCount: number }>;
  };
  customers: {
    total: number;
    subscribers: number;
    segments: Array<{ id: string; name: string; memberCount: number }>;
    topCountries: Array<{ country: string; count: number }>;
    recentSignups: number;
  };
  orders: {
    total: number;
    lastMonth: number;
    avgOrderValue: number;
    topProducts: Array<{ productName: string; quantity: number }>;
  };
  campaigns: {
    total: number;
    avgOpenRate: number;
    avgClickRate: number;
    bestPerforming: Array<{ name: string; openRate: number; clickRate: number }>;
  };
  seasonality: {
    currentMonth: string;
    currentSeason: string;
    upcomingHolidays: Array<{ name: string; date: string; daysUntil: number }>;
  };
  insights: {
    lowStockAlert: boolean;
    winBackOpportunity: number;
    highEngagementSegment?: string;
  };
}

// Error type classification
type AIErrorType = 'insufficient_credits' | 'rate_limit' | 'unknown';

interface AIError {
  type: AIErrorType;
  message: string;
}

function classifyError(error: Error | { message?: string; status?: number }): AIError {
  const msg = error.message || '';
  
  if (msg.includes('402') || msg.includes('credits') || msg.includes('Onvoldoende')) {
    return { type: 'insufficient_credits', message: 'Onvoldoende AI credits' };
  }
  if (msg.includes('429') || msg.includes('Rate limit') || msg.includes('rate limit')) {
    return { type: 'rate_limit', message: 'Te veel verzoeken. Wacht even en probeer opnieuw.' };
  }
  return { type: 'unknown', message: msg || 'Er ging iets mis' };
}

export function useAIMarketing() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Callback for when credits are needed
  const [onNeedCredits, setOnNeedCredits] = useState<(() => void) | null>(null);

  // Register callback for credit errors
  const registerCreditCallback = useCallback((callback: () => void) => {
    setOnNeedCredits(() => callback);
  }, []);

  // Unified error handler
  const handleAIError = useCallback((error: Error) => {
    const classified = classifyError(error);
    
    if (classified.type === 'insufficient_credits') {
      toast.error('Onvoldoende AI credits', {
        description: 'Koop extra credits om door te gaan.',
        action: onNeedCredits ? {
          label: 'Credits kopen',
          onClick: onNeedCredits,
        } : undefined,
      });
    } else if (classified.type === 'rate_limit') {
      toast.error('Te veel verzoeken', {
        description: 'Wacht even en probeer opnieuw.',
      });
    } else {
      toast.error('Fout bij genereren', { description: classified.message });
    }
  }, [onNeedCredits]);

  // Fetch marketing context
  const { data: context, isLoading: contextLoading, refetch: refetchContext } = useQuery({
    queryKey: ['ai-marketing-context', currentTenant?.id],
    queryFn: async (): Promise<MarketingContext | null> => {
      if (!currentTenant?.id) return null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('ai-marketing-context', {
        body: { tenantId: currentTenant.id },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data.context;
    },
    enabled: !!currentTenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Generate social post
  const generateSocialPost = useMutation({
    mutationFn: async (params: {
      platform: 'instagram' | 'facebook' | 'linkedin' | 'twitter';
      contentType: 'product_highlight' | 'low_stock_alert' | 'new_arrival' | 'seasonal' | 'custom';
      productIds?: string[];
      customPrompt?: string;
      tone?: 'professional' | 'casual' | 'playful' | 'urgent';
    }) => {
      if (!currentTenant?.id || !context) throw new Error('Missing context');

      setIsGenerating(true);
      const response = await supabase.functions.invoke('ai-generate-social', {
        body: {
          tenantId: currentTenant.id,
          context,
          ...params,
        },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-credits'] });
      toast.success('Social media post gegenereerd!');
    },
    onError: handleAIError,
    onSettled: () => {
      setIsGenerating(false);
    },
  });

  // Generate email content
  const generateEmailContent = useMutation({
    mutationFn: async (params: {
      campaignType: 'newsletter' | 'promotion' | 'win_back' | 'new_product' | 'low_stock' | 'custom';
      segmentId?: string;
      productIds?: string[];
      customPrompt?: string;
      includeDiscount?: boolean;
      discountPercentage?: number;
    }) => {
      if (!currentTenant?.id || !context) throw new Error('Missing context');

      setIsGenerating(true);
      const response = await supabase.functions.invoke('ai-generate-email', {
        body: {
          tenantId: currentTenant.id,
          context,
          ...params,
        },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-credits'] });
      toast.success('Email content gegenereerd!');
    },
    onError: handleAIError,
    onSettled: () => {
      setIsGenerating(false);
    },
  });

  // Get campaign suggestions
  const getCampaignSuggestions = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id || !context) throw new Error('Missing context');

      const response = await supabase.functions.invoke('ai-campaign-suggestions', {
        body: {
          tenantId: currentTenant.id,
          context,
        },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data.suggestions;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-credits'] });
    },
    onError: handleAIError,
  });

  // Fetch saved AI content
  const { data: savedContent } = useQuery({
    queryKey: ['ai-generated-content', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  return {
    context,
    contextLoading,
    refetchContext,
    generateSocialPost,
    generateEmailContent,
    getCampaignSuggestions,
    savedContent,
    isGenerating,
    registerCreditCallback,
  };
}
