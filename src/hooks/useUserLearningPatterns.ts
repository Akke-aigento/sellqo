import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

export interface UserLearningPattern {
  id: string;
  user_id: string;
  tenant_id: string;
  pattern_type: string;
  learned_value: Record<string, unknown>;
  confidence_score: number;
  sample_count: number;
  created_at: string;
  last_updated_at: string;
}

export interface UserBehavior {
  occurrence_count: number;
  should_learn: boolean;
  should_auto_apply: boolean;
}

export function useUserLearningPatterns() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  // Get current user's learning patterns
  const { data: userPatterns, isLoading } = useQuery({
    queryKey: ['user-learning-patterns', currentTenant?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('ai_user_learning_patterns')
        .select('*')
        .eq('user_id', user.id)
        .order('confidence_score', { ascending: false });

      if (error) throw error;
      return data as UserLearningPattern[];
    },
    enabled: !!currentTenant?.id,
  });

  // Get all tenant patterns (for admins)
  const { data: allTenantPatterns } = useQuery({
    queryKey: ['all-tenant-learning-patterns', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('ai_user_learning_patterns')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('user_id');

      if (error) throw error;
      return data as UserLearningPattern[];
    },
    enabled: !!currentTenant?.id,
  });

  // Track a user behavior (called when user edits AI suggestion)
  const trackBehavior = useMutation({
    mutationFn: async (params: {
      behaviorType: string;
      behaviorValue: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentTenant?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('track_user_behavior', {
        p_user_id: user.id,
        p_tenant_id: currentTenant.id,
        p_behavior_type: params.behaviorType,
        p_behavior_value: params.behaviorValue,
      });

      if (error) throw error;
      return data[0] as UserBehavior;
    },
    onSuccess: (result, variables) => {
      if (result.should_learn && !result.should_auto_apply) {
        toast.success('AI leert van je voorkeur!', {
          description: `Na nog ${5 - result.occurrence_count} keer wordt dit automatisch toegepast.`,
        });
      } else if (result.should_auto_apply) {
        toast.success('Voorkeur wordt nu automatisch toegepast', {
          description: 'De AI past dit voortaan direct toe.',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['user-learning-patterns'] });
    },
  });

  // Update a learning pattern directly
  const updatePattern = useMutation({
    mutationFn: async (params: {
      patternType: string;
      learnedValue: Record<string, string | number | boolean | null>;
      sampleCount?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentTenant?.id) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('update_user_learning_pattern', {
        p_user_id: user.id,
        p_tenant_id: currentTenant.id,
        p_pattern_type: params.patternType,
        p_learned_value: params.learnedValue,
        p_sample_count: params.sampleCount || 1,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-learning-patterns'] });
    },
  });

  // Delete a specific pattern
  const deletePattern = useMutation({
    mutationFn: async (patternId: string) => {
      const { error } = await supabase
        .from('ai_user_learning_patterns')
        .delete()
        .eq('id', patternId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Patroon verwijderd');
      queryClient.invalidateQueries({ queryKey: ['user-learning-patterns'] });
    },
  });

  // Clear all patterns for current user
  const clearAllPatterns = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('ai_user_learning_patterns')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Alle patronen gewist');
      queryClient.invalidateQueries({ queryKey: ['user-learning-patterns'] });
    },
  });

  // Helper to get a specific pattern value
  const getPatternValue = (patternType: string): unknown | null => {
    const pattern = userPatterns?.find(p => p.pattern_type === patternType);
    if (!pattern || pattern.confidence_score < 0.5) return null;
    return pattern.learned_value?.preference || pattern.learned_value;
  };

  // Helper to check if a pattern should auto-apply
  const shouldAutoApply = (patternType: string): boolean => {
    const pattern = userPatterns?.find(p => p.pattern_type === patternType);
    return pattern ? pattern.confidence_score >= 0.7 : false;
  };

  return {
    userPatterns,
    allTenantPatterns,
    isLoading,
    trackBehavior,
    updatePattern,
    deletePattern,
    clearAllPatterns,
    getPatternValue,
    shouldAutoApply,
  };
}
