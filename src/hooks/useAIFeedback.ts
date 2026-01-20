import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';
import type { AIFeedback, AILearningPattern } from '@/types/aiActions';

interface CreateFeedbackParams {
  contentId?: string;
  feedbackType: 'positive' | 'negative' | 'edit';
  originalContent?: string;
  editedContent?: string;
  editReason?: string;
  rating?: number;
  comments?: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

interface ContentEdit {
  editType: string;
  fieldChanged: string;
  beforeValue: string;
  afterValue: string;
}

export function useAIFeedback() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  // Submit feedback for AI content
  const submitFeedback = useMutation({
    mutationFn: async (params: CreateFeedbackParams) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('ai_feedback')
        .insert([{
          tenant_id: currentTenant.id,
          content_id: params.contentId,
          user_id: user?.id,
          feedback_type: params.feedbackType,
          original_content: params.originalContent,
          edited_content: params.editedContent,
          edit_reason: params.editReason,
          rating: params.rating,
          comments: params.comments,
          content_type: params.contentType,
          metadata: (params.metadata || {}) as Record<string, string | number | boolean | null>,
        }])
        .select()
        .single();

      if (error) throw error;

      // If it's an edit, trigger learning
      if (params.feedbackType === 'edit' && params.originalContent && params.editedContent) {
        await supabase.functions.invoke('ai-learn-from-feedback', {
          body: {
            tenantId: currentTenant.id,
            feedbackId: data.id,
            originalContent: params.originalContent,
            editedContent: params.editedContent,
            contentType: params.contentType,
          },
        });
      }

      return data as AIFeedback;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-learning-patterns'] });
      if (variables.feedbackType === 'positive') {
        toast.success('Bedankt voor je feedback! 👍');
      } else if (variables.feedbackType === 'edit') {
        toast.success('AI leert van je aanpassingen', {
          description: 'Toekomstige generaties worden beter afgestemd.',
        });
      }
    },
    onError: (error) => {
      console.error('Feedback error:', error);
      toast.error('Feedback opslaan mislukt');
    },
  });

  // Track specific content edits
  const trackEdit = useMutation({
    mutationFn: async (params: {
      contentId: string;
      feedbackId?: string;
      edits: ContentEdit[];
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const insertData = params.edits.map(edit => ({
        content_id: params.contentId,
        feedback_id: params.feedbackId,
        tenant_id: currentTenant.id,
        edit_type: edit.editType,
        field_changed: edit.fieldChanged,
        before_value: edit.beforeValue,
        after_value: edit.afterValue,
      }));

      const { error } = await supabase
        .from('ai_content_edits')
        .insert(insertData);

      if (error) throw error;
    },
  });

  // Get learning patterns for current tenant
  const { data: learningPatterns, isLoading: patternsLoading } = useQuery({
    queryKey: ['ai-learning-patterns', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('ai_learning_patterns')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('confidence_score', { ascending: false });

      if (error) throw error;
      return data as AILearningPattern[];
    },
    enabled: !!currentTenant?.id,
  });

  // Get feedback history
  const { data: feedbackHistory } = useQuery({
    queryKey: ['ai-feedback-history', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('ai_feedback')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as AIFeedback[];
    },
    enabled: !!currentTenant?.id,
  });

  // Get feedback stats
  const feedbackStats = feedbackHistory ? {
    total: feedbackHistory.length,
    positive: feedbackHistory.filter(f => f.feedback_type === 'positive').length,
    negative: feedbackHistory.filter(f => f.feedback_type === 'negative').length,
    edits: feedbackHistory.filter(f => f.feedback_type === 'edit').length,
    averageRating: feedbackHistory.filter(f => f.rating).reduce((acc, f) => acc + (f.rating || 0), 0) / 
      (feedbackHistory.filter(f => f.rating).length || 1),
  } : null;

  return {
    submitFeedback,
    trackEdit,
    learningPatterns,
    patternsLoading,
    feedbackHistory,
    feedbackStats,
  };
}
