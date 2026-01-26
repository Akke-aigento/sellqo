import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface FeedbackData {
  milestoneId?: string;
  rating?: number;
  isSatisfied?: boolean;
  feedbackText?: string;
  featureRequests?: string;
}

export function useAppFeedback() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const submitFeedback = useMutation({
    mutationFn: async (data: FeedbackData) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { error } = await supabase
        .from('app_feedback')
        .insert({
          tenant_id: currentTenant.id,
          user_id: user?.id,
          milestone_id: data.milestoneId,
          rating: data.rating,
          is_satisfied: data.isSatisfied,
          feedback_text: data.feedbackText,
          feature_requests: data.featureRequests,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Bedankt voor je feedback!');
      queryClient.invalidateQueries({ queryKey: ['app-feedback', currentTenant?.id] });
    },
    onError: () => {
      toast.error('Feedback kon niet worden verzonden');
    },
  });

  return {
    submitFeedback: (data: FeedbackData) => submitFeedback.mutateAsync(data),
    isSubmitting: submitFeedback.isPending,
  };
}
