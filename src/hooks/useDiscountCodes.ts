import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from '@/hooks/use-toast';
import type { DiscountCode, DiscountCodeFormData, DiscountCodeUsage } from '@/types/discount';

interface DiscountCodeFilters {
  search?: string;
  status?: 'all' | 'active' | 'inactive' | 'expired';
}

export function useDiscountCodes(filters?: DiscountCodeFilters) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['discount-codes', currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('discount_codes')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (filters?.search) {
        query = query.or(`code.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      if (filters?.status === 'active') {
        query = query.eq('is_active', true);
      } else if (filters?.status === 'inactive') {
        query = query.eq('is_active', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Filter expired codes if needed
      let result = data as DiscountCode[];
      if (filters?.status === 'expired') {
        const now = new Date().toISOString();
        result = result.filter(code => code.valid_until && code.valid_until < now);
      }

      return result;
    },
    enabled: !!currentTenant?.id,
  });
}

export function useDiscountCode(id: string | undefined) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['discount-code', id],
    queryFn: async () => {
      if (!id || !currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', currentTenant.id)
        .single();

      if (error) throw error;
      return data as DiscountCode;
    },
    enabled: !!id && !!currentTenant?.id,
  });
}

export function useDiscountCodeUsage(discountCodeId: string | undefined) {
  return useQuery({
    queryKey: ['discount-code-usage', discountCodeId],
    queryFn: async () => {
      if (!discountCodeId) return [];

      const { data, error } = await supabase
        .from('discount_code_usage')
        .select('*')
        .eq('discount_code_id', discountCodeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DiscountCodeUsage[];
    },
    enabled: !!discountCodeId,
  });
}

export function useCreateDiscountCode() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: DiscountCodeFormData) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const { data, error } = await supabase
        .from('discount_codes')
        .insert({
          tenant_id: currentTenant.id,
          code: formData.code.toUpperCase(),
          description: formData.description || null,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          minimum_order_amount: formData.minimum_order_amount,
          maximum_discount_amount: formData.maximum_discount_amount,
          usage_limit: formData.usage_limit,
          usage_limit_per_customer: formData.usage_limit_per_customer,
          valid_from: formData.valid_from,
          valid_until: formData.valid_until,
          is_active: formData.is_active,
          applies_to: formData.applies_to,
          product_ids: formData.product_ids.length > 0 ? formData.product_ids : null,
          category_ids: formData.category_ids.length > 0 ? formData.category_ids : null,
          first_order_only: formData.first_order_only,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      toast({
        title: 'Kortingscode aangemaakt',
        description: 'De kortingscode is succesvol aangemaakt.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij aanmaken',
        description: error.message.includes('duplicate') 
          ? 'Deze kortingscode bestaat al.' 
          : error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateDiscountCode() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<DiscountCodeFormData> }) => {
      const updateData: Record<string, unknown> = {};
      
      if (formData.code !== undefined) updateData.code = formData.code.toUpperCase();
      if (formData.description !== undefined) updateData.description = formData.description || null;
      if (formData.discount_type !== undefined) updateData.discount_type = formData.discount_type;
      if (formData.discount_value !== undefined) updateData.discount_value = formData.discount_value;
      if (formData.minimum_order_amount !== undefined) updateData.minimum_order_amount = formData.minimum_order_amount;
      if (formData.maximum_discount_amount !== undefined) updateData.maximum_discount_amount = formData.maximum_discount_amount;
      if (formData.usage_limit !== undefined) updateData.usage_limit = formData.usage_limit;
      if (formData.usage_limit_per_customer !== undefined) updateData.usage_limit_per_customer = formData.usage_limit_per_customer;
      if (formData.valid_from !== undefined) updateData.valid_from = formData.valid_from;
      if (formData.valid_until !== undefined) updateData.valid_until = formData.valid_until;
      if (formData.is_active !== undefined) updateData.is_active = formData.is_active;
      if (formData.applies_to !== undefined) updateData.applies_to = formData.applies_to;
      if (formData.product_ids !== undefined) updateData.product_ids = formData.product_ids.length > 0 ? formData.product_ids : null;
      if (formData.category_ids !== undefined) updateData.category_ids = formData.category_ids.length > 0 ? formData.category_ids : null;
      if (formData.first_order_only !== undefined) updateData.first_order_only = formData.first_order_only;

      const { data, error } = await supabase
        .from('discount_codes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      queryClient.invalidateQueries({ queryKey: ['discount-code'] });
      toast({
        title: 'Kortingscode bijgewerkt',
        description: 'De kortingscode is succesvol bijgewerkt.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij bijwerken',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteDiscountCode() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('discount_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      toast({
        title: 'Kortingscode verwijderd',
        description: 'De kortingscode is succesvol verwijderd.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij verwijderen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function generateRandomCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
