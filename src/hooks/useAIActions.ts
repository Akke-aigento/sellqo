import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { 
  AIActionSuggestion, 
  AISuggestionType, 
  AISuggestionStatus,
  AISuggestionPriority,
  AIQuickAction,
} from '@/types/aiActions';

interface CreateSuggestionParams {
  suggestionType: AISuggestionType;
  title: string;
  description?: string;
  priority?: AISuggestionPriority;
  confidenceScore?: number;
  reasoning?: string;
  actionData: Record<string, unknown>;
  expiresAt?: string;
  notificationId?: string;
}

// Helper function to safely parse database row to AIActionSuggestion
function parseAISuggestion(row: any): AIActionSuggestion {
  return {
    ...row,
    suggestion_type: row.suggestion_type as AISuggestionType,
    priority: row.priority as AISuggestionPriority,
    status: row.status as AISuggestionStatus,
    action_data: (row.action_data || {}) as Record<string, unknown>,
    user_modifications: (row.user_modifications || null) as Record<string, unknown> | null,
    quick_actions: (Array.isArray(row.quick_actions) ? row.quick_actions : []) as AIQuickAction[],
    analysis_context: (row.analysis_context || {}) as Record<string, unknown>,
  };
}

export function useAIActions() {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  // Fetch pending suggestions (excluding snoozed)
  const { data: pendingSuggestions, isLoading: suggestionsLoading, refetch: refetchSuggestions } = useQuery({
    queryKey: ['ai-action-suggestions', currentTenant?.id, 'pending'],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('ai_action_suggestions')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'pending')
        .or(`snoozed_until.is.null,snoozed_until.lt.${now}`)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(parseAISuggestion);
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch all suggestions with filters
  const useSuggestions = (filters?: { status?: AISuggestionStatus; type?: AISuggestionType }) => {
    return useQuery({
      queryKey: ['ai-action-suggestions', currentTenant?.id, filters],
      queryFn: async () => {
        if (!currentTenant?.id) return [];

        let query = supabase
          .from('ai_action_suggestions')
          .select('*')
          .eq('tenant_id', currentTenant.id)
          .order('created_at', { ascending: false });

        if (filters?.status) {
          query = query.eq('status', filters.status);
        }
        if (filters?.type) {
          query = query.eq('suggestion_type', filters.type);
        }

        const { data, error } = await query.limit(50);

        if (error) throw error;
        return (data || []).map(parseAISuggestion);
      },
      enabled: !!currentTenant?.id,
    });
  };

  // Get suggestion counts by priority
  const suggestionCounts = pendingSuggestions ? {
    total: pendingSuggestions.length,
    urgent: pendingSuggestions.filter(s => s.priority === 'urgent').length,
    high: pendingSuggestions.filter(s => s.priority === 'high').length,
    medium: pendingSuggestions.filter(s => s.priority === 'medium').length,
    low: pendingSuggestions.filter(s => s.priority === 'low').length,
    byType: Object.entries(
      pendingSuggestions.reduce((acc, s) => {
        acc[s.suggestion_type] = (acc[s.suggestion_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ),
  } : null;

  // Accept suggestion (execute as-is)
  const acceptSuggestion = useMutation({
    mutationFn: async (suggestionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('ai_action_suggestions')
        .update({
          status: 'accepted',
          executed_at: new Date().toISOString(),
          executed_by: user?.id,
        })
        .eq('id', suggestionId)
        .select()
        .single();

      if (error) throw error;
      return parseAISuggestion(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-action-suggestions'] });
      toast.success('Suggestie geaccepteerd');
    },
    onError: (error) => {
      console.error('Accept error:', error);
      toast.error('Accepteren mislukt');
    },
  });

  // Execute suggestion with modifications
  const executeSuggestion = useMutation({
    mutationFn: async (params: { 
      suggestionId: string; 
      modifications?: Record<string, unknown>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('ai_action_suggestions')
        .update({
          status: params.modifications ? 'modified' : 'executed',
          user_modifications: params.modifications ? JSON.parse(JSON.stringify(params.modifications)) : null,
          executed_at: new Date().toISOString(),
          executed_by: user?.id,
        })
        .eq('id', params.suggestionId)
        .select()
        .single();

      if (error) throw error;

      // APP-CLEAN-3b: de suggestie wordt als afgehandeld gemarkeerd; de eigenlijke actie
      // (inkooporder, campagne) maakt de gebruiker in het juiste scherm. Tot 12-10-2026
      // meldde dit "succesvol verwerkt" terwijl er alleen een console.log draaide.
      const suggestion = parseAISuggestion(data);
      const followUpUrl = followUpFor(suggestion);

      return { suggestion, followUpUrl };
    },
    onSuccess: ({ suggestion, followUpUrl }) => {
      queryClient.invalidateQueries({ queryKey: ['ai-action-suggestions'] });
      toast.success('Gemarkeerd als afgehandeld', {
        description: followUpUrl
          ? `${suggestion.title}: maak de actie zelf aan in het volgende scherm.`
          : suggestion.title,
        action: followUpUrl ? { label: 'Openen', onClick: () => navigate(followUpUrl) } : undefined,
      });
    },
    onError: (error) => {
      console.error('Execute error:', error);
      toast.error('Uitvoeren mislukt');
    },
  });

  // Reject suggestion
  const rejectSuggestion = useMutation({
    mutationFn: async (suggestionId: string) => {
      const { data, error } = await supabase
        .from('ai_action_suggestions')
        .update({ status: 'rejected' })
        .eq('id', suggestionId)
        .select()
        .single();

      if (error) throw error;
      return parseAISuggestion(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-action-suggestions'] });
      toast.success('Suggestie afgewezen');
    },
    onError: (error) => {
      console.error('Reject error:', error);
      toast.error('Afwijzen mislukt');
    },
  });

  // Create new suggestion (internal use)
  const createSuggestion = useMutation({
    mutationFn: async (params: CreateSuggestionParams) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('ai_action_suggestions')
        .insert([{
          tenant_id: currentTenant.id,
          suggestion_type: params.suggestionType,
          title: params.title,
          description: params.description,
          priority: params.priority || 'medium',
          confidence_score: params.confidenceScore || 0.5,
          reasoning: params.reasoning,
          action_data: JSON.parse(JSON.stringify(params.actionData)),
          expires_at: params.expiresAt,
          notification_id: params.notificationId,
        }])
        .select()
        .single();

      if (error) throw error;
      return parseAISuggestion(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-action-suggestions'] });
    },
  });

  // Trigger proactive analysis
  const triggerAnalysis = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const response = await supabase.functions.invoke('ai-proactive-monitor', {
        body: { tenantId: currentTenant.id },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-action-suggestions'] });
      toast.success('Analyse voltooid', {
        description: `${data.suggestionsCreated} nieuwe suggesties gegenereerd.`,
      });
    },
    onError: (error) => {
      console.error('Analysis error:', error);
      toast.error('Analyse mislukt');
    },
  });

  return {
    pendingSuggestions,
    suggestionsLoading,
    refetchSuggestions,
    suggestionCounts,
    useSuggestions,
    acceptSuggestion,
    executeSuggestion,
    rejectSuggestion,
    createSuggestion,
    triggerAnalysis,
  };
}

// APP-CLEAN-3b: waar de gebruiker de eigenlijke actie doet. Er wordt hier niets
// automatisch aangemaakt (dat deden de oude create*-functies ook niet: alleen console.log).
function followUpFor(suggestion: AIActionSuggestion): string | null {
  switch (suggestion.suggestion_type) {
    // ADMIN-DEAD-1: niet meer naar /admin/purchase-orders. Daar gaven "Nieuwe
    // inkooporder" en elke rij een 404 (zie APP-CLEAN-5). De producten met lage
    // voorraad is het scherm waar de gebruiker iets met de suggestie kan.
    case 'purchase_order':
    case 'stock_alert':
      return '/admin/products?stock=low';
    case 'marketing_campaign':
    case 'customer_winback':
      return '/admin/marketing?new=campaign';
    default:
      return null;
  }
}
