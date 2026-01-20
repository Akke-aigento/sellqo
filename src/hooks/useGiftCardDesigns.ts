import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import type { GiftCardDesign, GiftCardDesignFormData } from '@/types/giftCard';

export function useGiftCardDesigns() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['gift-card-designs', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('gift_card_designs')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as unknown as GiftCardDesign[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useCreateGiftCardDesign() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (formData: GiftCardDesignFormData) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      const { data, error } = await supabase
        .from('gift_card_designs')
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
      queryClient.invalidateQueries({ queryKey: ['gift-card-designs'] });
      toast({ title: 'Ontwerp aangemaakt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken ontwerp',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateGiftCardDesign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      formData,
    }: {
      id: string;
      formData: Partial<GiftCardDesignFormData>;
    }) => {
      const { data, error } = await supabase
        .from('gift_card_designs')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-card-designs'] });
      toast({ title: 'Ontwerp bijgewerkt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken ontwerp',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteGiftCardDesign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gift_card_designs').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-card-designs'] });
      toast({ title: 'Ontwerp verwijderd' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen ontwerp',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
