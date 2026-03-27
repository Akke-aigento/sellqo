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
      // Step 1: Fetch existing category_ids for this product
      const { data: existing, error: fetchError } = await (supabase as any)
        .from('product_categories')
        .select('category_id')
        .eq('product_id', productId);
      if (fetchError) throw fetchError;

      const existingIds = new Set<string>((existing || []).map((r: any) => r.category_id as string));
      const desiredIds = new Set<string>(categoryIds);

      // Step 2: Calculate diff
      const toDelete = [...existingIds].filter(id => !desiredIds.has(id));
      const toUpsert = categoryIds; // upsert all desired (idempotent)

      // Step 3: Delete removed categories
      if (toDelete.length > 0) {
        const { error: delError } = await (supabase as any)
          .from('product_categories')
          .delete()
          .eq('product_id', productId)
          .in('category_id', toDelete);
        if (delError) throw delError;
      }

      // Step 4: If no categories desired, delete all remaining and return
      if (toUpsert.length === 0) {
        // Clean up any stragglers
        const { error: delAllError } = await (supabase as any)
          .from('product_categories')
          .delete()
          .eq('product_id', productId);
        if (delAllError) throw delAllError;
        return;
      }

      // Determine primary
      const primary = primaryCategoryId && categoryIds.includes(primaryCategoryId)
        ? primaryCategoryId
        : categoryIds[0];

      const rows = toUpsert.map((catId, idx) => ({
        product_id: productId,
        category_id: catId,
        is_primary: catId === primary,
        sort_order: idx,
      }));

      // Step 5: Upsert desired categories
      const { error: upsertError } = await (supabase as any)
        .from('product_categories')
        .upsert(rows, { onConflict: 'product_id,category_id' });
      if (upsertError) throw upsertError;

      // Step 6: Verify write
      const { data: verify, error: verifyError } = await (supabase as any)
        .from('product_categories')
        .select('category_id')
        .eq('product_id', productId);
      if (verifyError) throw verifyError;

      const savedIds = new Set((verify || []).map((r: any) => r.category_id));
      const missing = categoryIds.filter(id => !savedIds.has(id));
      if (missing.length > 0) {
        throw new Error(`Categorieën konden niet volledig opgeslagen worden (${missing.length} ontbreken). Controleer je rechten.`);
      }
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
