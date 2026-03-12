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
      // Step 1: Remove categories no longer in the list
      if (categoryIds.length > 0) {
        const { error: delError } = await (supabase as any)
          .from('product_categories')
          .delete()
          .eq('product_id', productId)
          .not('category_id', 'in', `(${categoryIds.join(',')})`);
        if (delError) throw delError;
      } else {
        const { error: delError } = await (supabase as any)
          .from('product_categories')
          .delete()
          .eq('product_id', productId);
        if (delError) throw delError;
        return;
      }

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

      // Step 2: Upsert desired categories
      const { error } = await (supabase as any)
        .from('product_categories')
        .upsert(rows, { onConflict: 'product_id,category_id' });
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
