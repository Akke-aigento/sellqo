import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import type { Product, ProductFormData, BundleItem } from '@/types/product';

export function useProducts() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ['products', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];

      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!currentTenant,
  });

  const createProduct = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (!currentTenant) throw new Error('No tenant selected');

      const { data: product, error } = await supabase
        .from('products')
        .insert({
          ...data,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();

      if (error) throw error;
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', currentTenant?.id] });
      toast({ title: 'Product aangemaakt', description: 'Het product is succesvol toegevoegd.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductFormData> }) => {
      const { data: product, error } = await supabase
        .from('products')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', currentTenant?.id] });
      toast({ title: 'Product bijgewerkt', description: 'De wijzigingen zijn opgeslagen.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', currentTenant?.id] });
      toast({ title: 'Product verwijderd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const bulkUpdateProducts = useMutation({
    mutationFn: async ({ ids, data }: { ids: string[]; data: Partial<ProductFormData> }) => {
      const { error } = await supabase
        .from('products')
        .update(data)
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', currentTenant?.id] });
      toast({ title: 'Producten bijgewerkt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const bulkDeleteProducts = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', currentTenant?.id] });
      toast({ title: 'Producten verwijderd' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  // Bulk price adjustment using RPC
  const bulkAdjustPrices = useMutation({
    mutationFn: async ({ 
      ids, 
      adjustmentType, 
      adjustmentValue, 
      priceField = 'price' 
    }: { 
      ids: string[]; 
      adjustmentType: string; 
      adjustmentValue: number; 
      priceField?: string;
    }) => {
      const { error } = await supabase.rpc('bulk_adjust_prices', {
        p_product_ids: ids,
        p_adjustment_type: adjustmentType,
        p_adjustment_value: adjustmentValue,
        p_price_field: priceField,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', currentTenant?.id] });
      toast({ title: 'Prijzen bijgewerkt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  // Bulk stock adjustment using RPC
  const bulkAdjustStock = useMutation({
    mutationFn: async ({ 
      ids, 
      adjustmentType, 
      adjustmentValue 
    }: { 
      ids: string[]; 
      adjustmentType: string; 
      adjustmentValue: number;
    }) => {
      const { error } = await supabase.rpc('bulk_adjust_stock', {
        p_product_ids: ids,
        p_adjustment_type: adjustmentType,
        p_adjustment_value: adjustmentValue,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', currentTenant?.id] });
      toast({ title: 'Voorraad bijgewerkt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  // Bulk tags update using RPC
  const bulkUpdateTags = useMutation({
    mutationFn: async ({ 
      ids, 
      tagsToAdd = [], 
      tagsToRemove = [], 
      replaceAll = false, 
      replacementTags = [] 
    }: { 
      ids: string[]; 
      tagsToAdd?: string[]; 
      tagsToRemove?: string[]; 
      replaceAll?: boolean; 
      replacementTags?: string[];
    }) => {
      const { error } = await supabase.rpc('bulk_update_tags', {
        p_product_ids: ids,
        p_tags_to_add: tagsToAdd,
        p_tags_to_remove: tagsToRemove,
        p_replace_all: replaceAll,
        p_replacement_tags: replacementTags,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', currentTenant?.id] });
      toast({ title: 'Tags bijgewerkt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  // Bulk social channels update using RPC
  const bulkUpdateSocialChannels = useMutation({
    mutationFn: async ({ 
      ids, 
      socialChannels 
    }: { 
      ids: string[]; 
      socialChannels: Record<string, boolean>;
    }) => {
      const { error } = await supabase.rpc('bulk_update_social_channels', {
        p_product_ids: ids,
        p_social_channels: socialChannels,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', currentTenant?.id] });
      toast({ title: 'Social channels bijgewerkt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  return {
    products: productsQuery.data || [],
    isLoading: productsQuery.isLoading,
    error: productsQuery.error,
    createProduct,
    updateProduct,
    deleteProduct,
    bulkUpdateProducts,
    bulkDeleteProducts,
    bulkAdjustPrices,
    bulkAdjustStock,
    bulkUpdateTags,
    bulkUpdateSocialChannels,
    refetch: productsQuery.refetch,
  };
}

export function useProduct(id: string | undefined) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Product | null;
    },
    enabled: !!id && !!currentTenant,
  });
}

export function useProductBundleItems(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-bundle-items', productId],
    queryFn: async () => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from('product_bundle_items')
        .select(`
          *,
          child_product:products!product_bundle_items_child_product_id_fkey(
            id, name, price, images, featured_image, stock, track_inventory, slug
          )
        `)
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        child_product: item.child_product || undefined,
      })) as BundleItem[];
    },
    enabled: !!productId,
  });
}

export function useSaveBundleItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, items }: {
      productId: string;
      items: Array<{
        child_product_id: string;
        quantity: number;
        customer_can_adjust: boolean;
        min_quantity: number | null;
        max_quantity: number | null;
        sort_order: number;
      }>;
    }) => {
      // Delete existing items
      const { error: deleteError } = await supabase
        .from('product_bundle_items')
        .delete()
        .eq('product_id', productId);

      if (deleteError) throw deleteError;

      // Insert new items
      if (items.length > 0) {
        const { error: insertError } = await supabase
          .from('product_bundle_items')
          .insert(items.map(item => ({
            product_id: productId,
            ...item,
          })));

        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['product-bundle-items', productId] });
    },
  });
}
