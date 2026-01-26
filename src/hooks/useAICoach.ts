import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import type { AICoachSettings, AnalysisType, CoachPersonality, ProactiveLevel } from '@/types/aiCoach';

export function useAICoach() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch coach settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['ai-coach-settings', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('ai_coach_settings')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;

      // If no settings exist, create defaults
      if (!data) {
        const { data: newSettings, error: insertError } = await supabase
          .from('ai_coach_settings')
          .insert({ tenant_id: currentTenant.id })
          .select()
          .single();

        if (insertError) throw insertError;
        return newSettings as AICoachSettings;
      }

      return data as AICoachSettings;
    },
    enabled: !!currentTenant?.id,
  });

  // Update settings
  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<AICoachSettings>) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('ai_coach_settings')
        .update(updates)
        .eq('tenant_id', currentTenant.id)
        .select()
        .single();

      if (error) throw error;
      return data as AICoachSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-coach-settings'] });
      toast({
        title: 'Coach instellingen opgeslagen',
        description: 'De AI Coach past zich aan aan je voorkeuren.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij opslaan',
        description: error instanceof Error ? error.message : 'Onbekende fout',
        variant: 'destructive',
      });
    },
  });

  // Snooze a suggestion
  const snoozeSuggestion = useMutation({
    mutationFn: async ({ suggestionId, hours }: { suggestionId: string; hours: number }) => {
      const snoozeUntil = new Date();
      snoozeUntil.setHours(snoozeUntil.getHours() + hours);

      const { error } = await supabase
        .from('ai_action_suggestions')
        .update({ snoozed_until: snoozeUntil.toISOString() })
        .eq('id', suggestionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-action-suggestions'] });
      toast({
        title: 'Suggestie uitgesteld',
        description: 'Je krijgt deze suggestie later opnieuw te zien.',
      });
    },
  });

  // Mute a suggestion type
  const muteSuggestionType = useMutation({
    mutationFn: async (suggestionType: string) => {
      if (!settings) throw new Error('No settings');

      const currentMuted = settings.muted_suggestion_types || [];
      const newMuted = currentMuted.includes(suggestionType)
        ? currentMuted
        : [...currentMuted, suggestionType];

      return updateSettings.mutateAsync({ muted_suggestion_types: newMuted });
    },
    onSuccess: () => {
      toast({
        title: 'Type gedempt',
        description: 'Je krijgt dit type suggestie niet meer te zien.',
      });
    },
  });

  // Unmute a suggestion type
  const unmuteSuggestionType = useMutation({
    mutationFn: async (suggestionType: string) => {
      if (!settings) throw new Error('No settings');

      const currentMuted = settings.muted_suggestion_types || [];
      const newMuted = currentMuted.filter(t => t !== suggestionType);

      return updateSettings.mutateAsync({ muted_suggestion_types: newMuted });
    },
  });

  // Trigger manual analysis
  const triggerAnalysis = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const response = await supabase.functions.invoke('ai-business-coach', {
        body: { tenantId: currentTenant.id },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-action-suggestions'] });
      toast({
        title: 'Analyse voltooid',
        description: `${data?.suggestionsCreated || 0} nieuwe suggesties gevonden.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Analyse mislukt',
        description: error instanceof Error ? error.message : 'Onbekende fout',
        variant: 'destructive',
      });
    },
  });

  // Execute quick action
  const executeQuickAction = useMutation({
    mutationFn: async ({ 
      functionName, 
      params 
    }: { 
      functionName: string; 
      params: Record<string, unknown> 
    }) => {
      const response = await supabase.functions.invoke(functionName, {
        body: { ...params, tenantId: currentTenant?.id },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-action-suggestions'] });
      toast({
        title: 'Actie uitgevoerd',
        description: 'De actie is succesvol uitgevoerd.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Actie mislukt',
        description: error instanceof Error ? error.message : 'Onbekende fout',
        variant: 'destructive',
      });
    },
  });

  return {
    settings,
    settingsLoading,
    updateSettings,
    snoozeSuggestion,
    muteSuggestionType,
    unmuteSuggestionType,
    triggerAnalysis,
    executeQuickAction,
  };
}
