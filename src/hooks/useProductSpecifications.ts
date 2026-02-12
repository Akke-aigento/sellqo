import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProductSpecification, ProductCustomSpec } from '@/types/specifications';

export function useProductSpecifications(productId: string) {
  const queryClient = useQueryClient();

  // Fetch structured specifications
  const specQuery = useQuery({
    queryKey: ['product-specifications', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_specifications')
        .select('*')
        .eq('product_id', productId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    },
    enabled: !!productId,
  });

  // Fetch custom specs
  const customSpecsQuery = useQuery({
    queryKey: ['product-custom-specs', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_custom_specs')
        .select('*')
        .eq('product_id', productId)
        .order('group_sort_order', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!productId,
  });

  // Upsert specification
  const upsertSpecMutation = useMutation({
    mutationFn: async (updates: Partial<ProductSpecification>) => {
      // Cast composition to Json-compatible format
      const updateData: any = { ...updates };
      if (updateData.composition) {
        updateData.composition = updateData.composition as any;
      }

      if (!specQuery.data?.id) {
        // Create new specification record
        const { data, error } = await supabase
          .from('product_specifications')
          .insert([
            {
              product_id: productId,
              ...updateData,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      // Update existing
      const { data, error } = await supabase
        .from('product_specifications')
        .update(updateData)
        .eq('id', specQuery.data.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-specifications', productId] });
    },
  });

  // Add custom spec
  const addCustomSpecMutation = useMutation({
    mutationFn: async (spec: Omit<ProductCustomSpec, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('product_custom_specs')
        .insert([spec])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-custom-specs', productId] });
    },
  });

  // Update custom spec
  const updateCustomSpecMutation = useMutation({
    mutationFn: async (spec: Partial<ProductCustomSpec> & { id: string }) => {
      const { id, ...updates } = spec;
      const { data, error } = await supabase
        .from('product_custom_specs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-custom-specs', productId] });
    },
  });

  // Delete custom spec
  const deleteCustomSpecMutation = useMutation({
    mutationFn: async (specId: string) => {
      const { error } = await supabase
        .from('product_custom_specs')
        .delete()
        .eq('id', specId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-custom-specs', productId] });
    },
  });

  // Reorder custom specs
  const reorderCustomSpecsMutation = useMutation({
    mutationFn: async (specs: Array<{ id: string; sort_order: number; group_sort_order: number }>) => {
      // Update all specs with new order
      const updates = specs.map((spec) =>
        supabase
          .from('product_custom_specs')
          .update({ sort_order: spec.sort_order, group_sort_order: spec.group_sort_order })
          .eq('id', spec.id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        throw errors[0].error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-custom-specs', productId] });
    },
  });

  return {
    specification: specQuery.data,
    customSpecs: customSpecsQuery.data || [],
    isLoading: specQuery.isLoading || customSpecsQuery.isLoading,
    error: specQuery.error || customSpecsQuery.error,
    upsertSpec: upsertSpecMutation.mutate,
    addCustomSpec: addCustomSpecMutation.mutate,
    updateCustomSpec: updateCustomSpecMutation.mutate,
    deleteCustomSpec: deleteCustomSpecMutation.mutate,
    reorderCustomSpecs: reorderCustomSpecsMutation.mutate,
  };
}
