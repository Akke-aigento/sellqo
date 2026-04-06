import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export function useCustomerTags() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['customer-tags', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('customers')
        .select('tags')
        .eq('tenant_id', currentTenant.id)
        .not('tags', 'is', null);

      if (error) throw error;

      // Extract unique tags from all customers
      const tagSet = new Set<string>();
      for (const row of data || []) {
        if (Array.isArray(row.tags)) {
          for (const tag of row.tags) {
            if (tag) tagSet.add(tag);
          }
        }
      }
      return Array.from(tagSet).sort();
    },
    enabled: !!currentTenant?.id,
  });
}
