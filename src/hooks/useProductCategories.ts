import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ProductCategory {
  id: string;
  product_id: string;
  category_id: string;
  is_primary: boolean;
  sort_order: number;
}

export function useProductCategories(productId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: productCategories = [], isLoading } = useQuery({
    queryKey: ['product-categories', productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await (supabase as any)
        .from('product_categories')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as ProductCategory[];
    },
    enabled: !!productId,
  });

  const syncCategories = useMutation({
    mutationFn: async ({ productId, categoryIds, primaryCategoryId }: {
      productId: string;
      categoryIds: string[];
      primaryCategoryId: string | null;
    }) => {
      // Delete all existing
      await (supabase as any)
        .from('product_categories')
        .delete()
        .eq('product_id', productId);

      if (categoryIds.length === 0) return;

      // If no explicit primary, use first
      const primary = primaryCategoryId && categoryIds.includes(primaryCategoryId)
        ? primaryCategoryId
        : categoryIds[0];

      const rows = categoryIds.map((catId, idx) => ({
        product_id: productId,
        category_id: catId,
        is_primary: catId === primary,
        sort_order: idx,
      }));

      const { error } = await (supabase as any)
        .from('product_categories')
        .insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['product-categories', vars.productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const categoryIds = productCategories.map(pc => pc.category_id);
  const primaryCategoryId = productCategories.find(pc => pc.is_primary)?.category_id || null;

  return {
    productCategories,
    categoryIds,
    primaryCategoryId,
    isLoading,
    syncCategories,
  };
}
