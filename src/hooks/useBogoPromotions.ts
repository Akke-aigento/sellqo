import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import type { BogoPromotion, BogoPromotionFormData } from '@/types/promotions';

export function useBogoPromotions() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['bogo-promotions', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('bogo_promotions')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BogoPromotion[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useBogoPromotion(id: string | undefined) {
  return useQuery({
    queryKey: ['bogo-promotions', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('bogo_promotions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as BogoPromotion;
    },
    enabled: !!id,
  });
}

export function useCreateBogoPromotion() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (formData: BogoPromotionFormData) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      const { data, error } = await supabase
        .from('bogo_promotions')
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
      queryClient.invalidateQueries({ queryKey: ['bogo-promotions'] });
      toast({ title: 'BOGO actie aangemaakt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken BOGO actie',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateBogoPromotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<BogoPromotionFormData> }) => {
      const { data, error } = await supabase
        .from('bogo_promotions')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bogo-promotions'] });
      toast({ title: 'BOGO actie bijgewerkt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken BOGO actie',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteBogoPromotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bogo_promotions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bogo-promotions'] });
      toast({ title: 'BOGO actie verwijderd' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen BOGO actie',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
