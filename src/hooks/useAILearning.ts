import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

interface LearnFromEditOptions {
  showToast?: boolean;
  contentType?: string;
}

export function useAILearning() {
  const { currentTenant } = useTenant();

  const learnFromEdit = useCallback(async (
    originalContent: string,
    editedContent: string,
    options: LearnFromEditOptions = {}
  ) => {
    const { showToast = false, contentType = 'storefront_copy' } = options;

    if (!currentTenant?.id) {
      console.warn('No tenant ID available for AI learning');
      return;
    }

    // Don't learn from very small changes (typos, etc.)
    if (Math.abs(originalContent.length - editedContent.length) < 3 && 
        originalContent.toLowerCase() === editedContent.toLowerCase()) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // First, create a feedback record
      const { data: feedback, error: feedbackError } = await supabase
        .from('ai_feedback')
        .insert({
          tenant_id: currentTenant.id,
          user_id: user?.id,
          feedback_type: 'edit',
          original_content: originalContent,
          edited_content: editedContent,
          content_type: contentType,
        })
        .select()
        .single();

      if (feedbackError) {
        console.error('Error creating feedback:', feedbackError);
        return;
      }

      // Then trigger the learning function
      const { error } = await supabase.functions.invoke('ai-learn-from-feedback', {
        body: {
          tenantId: currentTenant.id,
          feedbackId: feedback.id,
          userId: user?.id,
          originalContent,
          editedContent,
          contentType,
        },
      });

      if (error) {
        console.error('Error triggering learning:', error);
        return;
      }

      if (showToast) {
        toast.success('AI leert van je aanpassing', {
          description: 'Toekomstige teksten worden beter afgestemd op jouw stijl.',
        });
      }
    } catch (error) {
      console.error('Error in learnFromEdit:', error);
    }
  }, [currentTenant?.id]);

  return { learnFromEdit };
}
