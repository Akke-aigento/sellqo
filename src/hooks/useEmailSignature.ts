import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

export interface EmailSignature {
  id: string;
  tenant_id: string;
  user_id: string | null;
  name: string;
  body_html: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useEmailSignatures() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['email-signatures', currentTenant?.id];

  const { data: signatures = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('email_signatures')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('is_default', { ascending: false });
      if (error) throw error;
      return data as EmailSignature[];
    },
    enabled: !!currentTenant?.id,
  });

  const defaultSignature = signatures.find(s => s.is_default) || signatures[0] || null;

  const upsertSignature = useMutation({
    mutationFn: async (input: { id?: string; name: string; body_html: string; is_default: boolean }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // If setting as default, unset others first
      if (input.is_default) {
        await supabase
          .from('email_signatures')
          .update({ is_default: false })
          .eq('tenant_id', currentTenant.id);
      }

      if (input.id) {
        const { error } = await supabase
          .from('email_signatures')
          .update({ name: input.name, body_html: input.body_html, is_default: input.is_default })
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_signatures')
          .insert({ tenant_id: currentTenant.id, name: input.name, body_html: input.body_html, is_default: input.is_default });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Handtekening opgeslagen' });
    },
    onError: (err: Error) => {
      toast({ title: 'Fout', description: err.message, variant: 'destructive' });
    },
  });

  const deleteSignature = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_signatures').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Handtekening verwijderd' });
    },
  });

  return { signatures, defaultSignature, isLoading, upsertSignature, deleteSignature };
}
