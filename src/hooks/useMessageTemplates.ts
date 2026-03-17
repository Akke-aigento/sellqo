import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

export interface MessageTemplate {
  id: string;
  tenant_id: string;
  name: string;
  body: string;
  category: string;
  channel: string;
  shortcut: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export function useMessageTemplates() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['message-templates', currentTenant?.id];

  const { data: templates = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('usage_count', { ascending: false });
      if (error) throw error;
      return data as MessageTemplate[];
    },
    enabled: !!currentTenant?.id,
  });

  const createTemplate = useMutation({
    mutationFn: async (input: { name: string; body: string; category?: string; channel?: string; shortcut?: string }) => {
      if (!currentTenant?.id) throw new Error('No tenant');
      const { data, error } = await supabase
        .from('message_templates')
        .insert({ tenant_id: currentTenant.id, ...input })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Sjabloon aangemaakt' });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; body?: string; category?: string; channel?: string; shortcut?: string }) => {
      const { error } = await supabase
        .from('message_templates')
        .update(input)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Sjabloon verwijderd' });
    },
  });

  const incrementUsage = useMutation({
    mutationFn: async (id: string) => {
      const template = templates.find(t => t.id === id);
      if (!template) return;
      await supabase
        .from('message_templates')
        .update({ usage_count: template.usage_count + 1 })
        .eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { templates, isLoading, createTemplate, updateTemplate, deleteTemplate, incrementUsage };
}
