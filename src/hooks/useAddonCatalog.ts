// FOOD-2 — alle actieve extra's van de winkel, één keer geladen voor de kassa.
// DEMO-1: ook de extra categorieën van een product (product_categories), net als de webshop.
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { groupsForProduct, type AddonGroupLite } from '@/lib/productAddons';

export function useAddonCatalog(enabled = true) {
  const { currentTenant } = useTenant();
  const { data } = useQuery({
    queryKey: ['addon-catalog', currentTenant?.id],
    enabled: enabled && !!currentTenant?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [g, o, pc] = await Promise.all([
        supabase.from('product_addon_groups').select('id, name, min_select, max_select, category_ids, product_ids, sort_order')
          .eq('tenant_id', currentTenant!.id).eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('product_addon_options').select('id, group_id, name, price')
          .eq('tenant_id', currentTenant!.id).eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('product_categories').select('product_id, category_id, products!inner(tenant_id)')
          .eq('products.tenant_id', currentTenant!.id).limit(5000),
      ]);
      if (g.error) throw g.error;
      if (o.error) throw o.error;
      // Extra categorieën zijn een aanvulling: lukt die query niet, dan blijft de hoofdcategorie werken.
      const extraCats = new Map<string, string[]>();
      for (const row of (pc.error ? [] : pc.data || []) as { product_id: string; category_id: string }[]) {
        extraCats.set(row.product_id, [...(extraCats.get(row.product_id) || []), row.category_id]);
      }
      return { groups: g.data || [], options: o.data || [], extraCats };
    },
  });
  const forProduct = useCallback(
    (productId: string, categoryId: string | null | undefined): AddonGroupLite[] =>
      data && enabled ? groupsForProduct(data.groups, data.options, productId, [categoryId, ...(data.extraCats.get(productId) || [])]) : [],
    [data, enabled],
  );
  return { forProduct, ready: !!data };
}
