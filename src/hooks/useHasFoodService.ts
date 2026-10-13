// FOOD-2 — biedt deze winkel afhalen of leveren aan (restaurant, frituur, kebabzaak)?
// Stuurt het keukenmenu in de zijbalk en de keukenbon in de kassa. Eén telling per tenant.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export function useHasFoodService(): boolean {
  const { currentTenant } = useTenant();
  const { data = false } = useQuery({
    queryKey: ['has-food-service', currentTenant?.id],
    enabled: !!currentTenant?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { count } = await supabase.from('shipping_methods').select('id', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant!.id).in('fulfillment_type', ['pickup', 'local_delivery']).eq('is_active', true);
      return (count ?? 0) > 0;
    },
  });
  return data;
}
