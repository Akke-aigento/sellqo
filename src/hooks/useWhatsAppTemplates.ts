import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import type { Json } from '@/integrations/supabase/types';

export type WhatsAppTemplateType = 
  | 'order_confirmation' 
  | 'shipping_update' 
  | 'delivery_confirmation'
  | 'abandoned_cart' 
  | 'payment_reminder' 
  | 'review_request' 
  | 'custom';

export type WhatsAppTemplateStatus = 'pending' | 'approved' | 'rejected';

export interface WhatsAppTemplate {
  id: string;
  tenant_id: string;
  template_name: string;
  template_type: WhatsAppTemplateType;
  language: string;
  status: WhatsAppTemplateStatus;
  meta_template_id: string | null;
  header_text: string | null;
  body_text: string;
  footer_text: string | null;
  buttons: Json;
  variables: Json;
  created_at: string;
  updated_at: string;
}

interface CreateTemplateInput {
  template_name: string;
  template_type: WhatsAppTemplateType;
  language?: string;
  header_text?: string;
  body_text: string;
  footer_text?: string;
  buttons?: Json;
  variables?: Json;
}

export function useWhatsAppTemplates() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['whatsapp-templates', currentTenant?.id];

  const { data: templates = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('template_type', { ascending: true });

      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
    enabled: !!currentTenant?.id,
  });

  const createTemplate = useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      if (!currentTenant?.id) {
        throw new Error('No tenant selected');
      }

      const { data, error } = await supabase
        .from('whatsapp_templates')
        .insert({
          tenant_id: currentTenant.id,
          template_name: input.template_name,
          template_type: input.template_type,
          language: input.language || 'nl',
          header_text: input.header_text,
          body_text: input.body_text,
          footer_text: input.footer_text,
          buttons: input.buttons || [],
          variables: input.variables || [],
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'Template aangemaakt',
        description: 'De template is opgeslagen en wacht op goedkeuring.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Aanmaken mislukt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WhatsAppTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .update({
          template_name: updates.template_name,
          template_type: updates.template_type,
          language: updates.language,
          header_text: updates.header_text,
          body_text: updates.body_text,
          footer_text: updates.footer_text,
          buttons: updates.buttons,
          variables: updates.variables,
          status: updates.status,
          meta_template_id: updates.meta_template_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'Template bijgewerkt',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Bijwerken mislukt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'Template verwijderd',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Verwijderen mislukt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getTemplateByType = (type: WhatsAppTemplateType) => {
    return templates.find(t => t.template_type === type && t.status === 'approved');
  };

  return {
    templates,
    isLoading,
    error,
    refetch,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplateByType,
  };
}
