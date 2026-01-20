import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import type { DiscountStackingRule, StackingRuleFormData } from '@/types/promotions';

export function useStackingRules() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['stacking-rules', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('discount_stacking_rules')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DiscountStackingRule[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useStackingRule(id: string | undefined) {
  return useQuery({
    queryKey: ['stacking-rules', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('discount_stacking_rules')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as DiscountStackingRule;
    },
    enabled: !!id,
  });
}

export function useCreateStackingRule() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (formData: StackingRuleFormData) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      const { data, error } = await supabase
        .from('discount_stacking_rules')
        .insert({
          ...formData,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacking-rules'] });
      toast({ title: 'Stapelregel aangemaakt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken stapelregel',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateStackingRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<StackingRuleFormData> }) => {
      const { data, error } = await supabase
        .from('discount_stacking_rules')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacking-rules'] });
      toast({ title: 'Stapelregel bijgewerkt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken stapelregel',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteStackingRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('discount_stacking_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stacking-rules'] });
      toast({ title: 'Stapelregel verwijderd' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen stapelregel',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
