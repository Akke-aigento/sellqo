// FOOD-2 — alle actieve extra's van de winkel, één keer geladen voor de kassa.
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { groupsForProduct, type AddonGroupLite } from '@/lib/productAddons';

export function useAddonCatalog() {
  const { currentTenant } = useTenant();
  const { data } = useQuery({
    queryKey: ['addon-catalog', currentTenant?.id],
    enabled: !!currentTenant?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [g, o] = await Promise.all([
        supabase.from('product_addon_groups').select('id, name, min_select, max_select, category_ids, product_ids, sort_order')
          .eq('tenant_id', currentTenant!.id).eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('product_addon_options').select('id, group_id, name, price')
          .eq('tenant_id', currentTenant!.id).eq('is_active', true).order('sort_order', { ascending: true }),
      ]);
      if (g.error) throw g.error;
      if (o.error) throw o.error;
      return { groups: g.data || [], options: o.data || [] };
    },
  });
  const forProduct = useCallback(
    (productId: string, categoryId: string | null | undefined): AddonGroupLite[] =>
      data ? groupsForProduct(data.groups, data.options, productId, [categoryId]) : [],
    [data],
  );
  return { forProduct, ready: !!data };
}
