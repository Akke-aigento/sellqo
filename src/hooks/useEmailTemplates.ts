import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import type { EmailTemplate } from '@/types/marketing';
import type { Json } from '@/integrations/supabase/types';

export function useEmailTemplates() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ['email-templates', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EmailTemplate[];
    },
    enabled: !!currentTenant?.id,
  });

  const createTemplate = useMutation({
    mutationFn: async (template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          ...template,
          json_content: template.json_content as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({ title: 'Template aangemaakt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij aanmaken', description: error.message, variant: 'destructive' });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>> & { id: string }) => {
      const { data, error } = await supabase
        .from('email_templates')
        .update({
          ...updates,
          json_content: updates.json_content as Json,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({ title: 'Template bijgewerkt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij bijwerken', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({ title: 'Template verwijderd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij verwijderen', description: error.message, variant: 'destructive' });
    },
  });

  return {
    templates,
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}

export function useEmailTemplate(id: string | undefined) {
  const { data: template, isLoading, error } = useQuery({
    queryKey: ['email-template', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as EmailTemplate | null;
    },
    enabled: !!id,
  });

  return { template, isLoading, error };
}
