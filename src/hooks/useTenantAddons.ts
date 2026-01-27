import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export interface TenantAddon {
  id: string;
  tenant_id: string;
  addon_type: string;
  status: 'active' | 'cancelled' | 'pending';
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  price_monthly: number | null;
  activated_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useTenantAddons() {
  const { currentTenant } = useTenant();

  const { data: addons, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant-addons', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('tenant_addons')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'active');

      if (error) throw error;
      return (data || []) as TenantAddon[];
    },
    enabled: !!currentTenant?.id,
  });

  const hasAddon = (addonType: string): boolean => {
    return addons?.some(
      addon => addon.addon_type === addonType && addon.status === 'active'
    ) ?? false;
  };

  return {
    addons: addons ?? [],
    isLoading,
    error,
    refetch,
    hasAddon,
  };
}
