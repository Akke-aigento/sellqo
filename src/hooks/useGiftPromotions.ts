import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import type { GiftPromotion, GiftPromotionFormData } from '@/types/promotions';

export function useGiftPromotions() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['gift-promotions', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('gift_promotions')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as GiftPromotion[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useGiftPromotion(id: string | undefined) {
  return useQuery({
    queryKey: ['gift-promotions', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('gift_promotions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as GiftPromotion;
    },
    enabled: !!id,
  });
}

export function useCreateGiftPromotion() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (formData: GiftPromotionFormData) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      const { data, error } = await supabase
        .from('gift_promotions')
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
      queryClient.invalidateQueries({ queryKey: ['gift-promotions'] });
      toast({ title: 'Cadeau actie aangemaakt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken cadeau actie',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateGiftPromotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<GiftPromotionFormData> }) => {
      const { data, error } = await supabase
        .from('gift_promotions')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-promotions'] });
      toast({ title: 'Cadeau actie bijgewerkt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken cadeau actie',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteGiftPromotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('gift_promotions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-promotions'] });
      toast({ title: 'Cadeau actie verwijderd' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen cadeau actie',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
