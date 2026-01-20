import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import type { AutomaticDiscount, AutomaticDiscountFormData, AutoDiscountSchedule } from '@/types/promotions';

export function useAutoDiscounts() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['auto-discounts', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('automatic_discounts')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('priority', { ascending: true });

      if (error) throw error;
      return data.map(d => ({
        ...d,
        schedule: d.schedule as AutoDiscountSchedule | null,
      })) as AutomaticDiscount[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useAutoDiscount(id: string | undefined) {
  return useQuery({
    queryKey: ['auto-discounts', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('automatic_discounts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return {
        ...data,
        schedule: data.schedule as AutoDiscountSchedule | null,
      } as AutomaticDiscount;
    },
    enabled: !!id,
  });
}

export function useCreateAutoDiscount() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (formData: AutomaticDiscountFormData) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      const { data, error } = await supabase
        .from('automatic_discounts')
        .insert({
          name: formData.name,
          description: formData.description,
          trigger_type: formData.trigger_type,
          trigger_value: formData.trigger_value,
          trigger_product_ids: formData.trigger_product_ids,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          free_product_id: formData.free_product_id,
          applies_to: formData.applies_to,
          product_ids: formData.product_ids,
          max_discount_amount: formData.max_discount_amount,
          schedule: formData.schedule as unknown as Record<string, unknown>,
          priority: formData.priority,
          is_active: formData.is_active,
          valid_from: formData.valid_from,
          valid_until: formData.valid_until,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-discounts'] });
      toast({ title: 'Automatische korting aangemaakt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken automatische korting',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateAutoDiscount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<AutomaticDiscountFormData> }) => {
      const updateData: Record<string, unknown> = { ...formData };
      if (formData.schedule) {
        updateData.schedule = formData.schedule as unknown as Record<string, unknown>;
      }
      
      const { data, error } = await supabase
        .from('automatic_discounts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-discounts'] });
      toast({ title: 'Automatische korting bijgewerkt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken automatische korting',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteAutoDiscount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('automatic_discounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-discounts'] });
      toast({ title: 'Automatische korting verwijderd' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen automatische korting',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
