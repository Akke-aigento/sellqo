import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import type { ProductBundle, ProductBundleFormData, BundleProduct } from '@/types/promotions';

export function useBundles() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['bundles', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('product_bundles')
        .select(`
          *,
          products:bundle_products(
            *,
            product:products(id, name, price, images)
          )
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as ProductBundle[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useBundle(id: string | undefined) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['bundles', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('product_bundles')
        .select(`
          *,
          products:bundle_products(
            *,
            product:products(id, name, price, images)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as ProductBundle;
    },
    enabled: !!id && !!currentTenant?.id,
  });
}

export function useCreateBundle() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (formData: ProductBundleFormData) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      const { products, ...bundleData } = formData;

      const { data: bundle, error: bundleError } = await supabase
        .from('product_bundles')
        .insert([{
          name: bundleData.name,
          slug: bundleData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          description: bundleData.description,
          bundle_type: bundleData.bundle_type,
          discount_type: bundleData.discount_type,
          discount_value: bundleData.discount_value,
          is_active: bundleData.is_active,
          valid_from: bundleData.valid_from,
          valid_until: bundleData.valid_until,
          min_items: bundleData.min_items,
          max_items: bundleData.max_items,
          tenant_id: currentTenant.id,
        }])
        .select()
        .single();

      if (bundleError) throw bundleError;

      // Create bundle products
      if (products.length > 0) {
        const bundleProducts = products.map((p, index) => ({
          bundle_id: bundle.id,
          product_id: p.product_id,
          quantity: p.quantity,
          is_required: p.is_required,
          group_name: p.group_name || null,
          sort_order: index,
        }));

        const { error: productsError } = await supabase
          .from('bundle_products')
          .insert(bundleProducts);

        if (productsError) throw productsError;
      }

      return bundle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
      toast({ title: 'Bundel aangemaakt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken bundel',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Partial<ProductBundleFormData> }) => {
      const { products, ...bundleData } = formData;

      // Update bundle
      const { data: bundle, error: bundleError } = await supabase
        .from('product_bundles')
        .update(bundleData)
        .eq('id', id)
        .select()
        .single();

      if (bundleError) throw bundleError;

      // Update products if provided
      if (products) {
        // Remove existing products
        await supabase.from('bundle_products').delete().eq('bundle_id', id);

        // Insert new products
        if (products.length > 0) {
          const bundleProducts = products.map((p, index) => ({
            bundle_id: id,
            product_id: p.product_id,
            quantity: p.quantity,
            is_required: p.is_required,
            group_name: p.group_name || null,
            sort_order: index,
          }));

          const { error: productsError } = await supabase
            .from('bundle_products')
            .insert(bundleProducts);

          if (productsError) throw productsError;
        }
      }

      return bundle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
      toast({ title: 'Bundel bijgewerkt' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken bundel',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_bundles')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
      toast({ title: 'Bundel verwijderd' });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen bundel',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
