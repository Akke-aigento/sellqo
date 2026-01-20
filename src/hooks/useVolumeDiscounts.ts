import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import type { VolumeDiscount, VolumeDiscountFormData } from '@/types/promotions';

export function useVolumeDiscounts() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['volume-discounts', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('volume_discounts')
        .select(`
          *,
          tiers:volume_discount_tiers(*)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as VolumeDiscount[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useVolumeDiscount(id: string | undefined) {
  return useQuery({
    queryKey: ['volume-discounts', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('volume_discounts')
        .select(`
          *,
          tiers:volume_discount_tiers(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as VolumeDiscount;
    },
    enabled: !!id,
  });
}

export function useCreateVolumeDiscount() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (formData: VolumeDiscountFormData) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      const { tiers, ...discountData } = formData;

      // Create volume discount
      const { data: discount, error: discountError } = await supabase
        .from('volume_discounts')
        .insert({
          ...discountData,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();

      if (discountError) throw discountError;

      // Create tiers
      if (tiers.length > 0) {
        const tierData = tiers.map((t) => ({
          volume_discount_id: discount.id,
          min_quantity: t.min_quantity,
          max_quantity: t.max_quantity || null,
          discount_type: t.discount_type,
          discount_value: t.discount_value,
        }));

        const { error: tiersError } = await supabase
          .from('volume_discount_tiers')
          .insert(tierData);

        if (tiersError) throw tiersError;
      }

      return discount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volume-discounts'] });
      toast({ title: 'Staffelkorting aangemaakt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken staffelkorting',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateVolumeDiscount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<VolumeDiscountFormData> }) => {
      const { tiers, ...discountData } = formData;

      // Update discount
      const { data: discount, error: discountError } = await supabase
        .from('volume_discounts')
        .update(discountData)
        .eq('id', id)
        .select()
        .single();

      if (discountError) throw discountError;

      // Update tiers if provided
      if (tiers) {
        await supabase.from('volume_discount_tiers').delete().eq('volume_discount_id', id);

        if (tiers.length > 0) {
          const tierData = tiers.map((t) => ({
            volume_discount_id: id,
            min_quantity: t.min_quantity,
            max_quantity: t.max_quantity || null,
            discount_type: t.discount_type,
            discount_value: t.discount_value,
          }));

          const { error: tiersError } = await supabase
            .from('volume_discount_tiers')
            .insert(tierData);

          if (tiersError) throw tiersError;
        }
      }

      return discount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volume-discounts'] });
      toast({ title: 'Staffelkorting bijgewerkt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken staffelkorting',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteVolumeDiscount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('volume_discounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volume-discounts'] });
      toast({ title: 'Staffelkorting verwijderd' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen staffelkorting',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
