// DASH-2a — signalen voor de ochtendbrief die niets met omzet te maken hebben:
// de oudste openstaande verzending en producten die op raken.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { fetchAllRows } from '@/lib/salesStats';
import type { BriefStockProduct } from '@/lib/cockpitBrief';

/** Betaald, nog niet verstuurd, en niet geannuleerd of geretourneerd. */
const OPEN_SHIPPING_STATUSES = ['pending', 'processing'] as const;

export function useCockpitShipping(enabled: boolean) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['cockpit-shipping', tenantId],
    enabled: enabled && !!tenantId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, count, error } = await supabase
        .from('orders')
        .select('created_at', { count: 'exact' })
        .eq('tenant_id', tenantId!)
        .eq('payment_status', 'paid')
        .eq('fulfillment_status', 'unfulfilled')
        .in('status', [...OPEN_SHIPPING_STATUSES])
        .order('created_at', { ascending: true })
        .limit(1);
      if (error) throw error;
      const oldest = data?.[0]?.created_at;
      return {
        openCount: count ?? 0,
        oldestAgeMs: oldest ? Math.max(0, Date.now() - new Date(oldest).getTime()) : null,
      };
    },
  });
}

export function useCockpitStock(enabled: boolean) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['cockpit-stock', tenantId],
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    // PostgREST kan stock niet met low_stock_threshold vergelijken: filteren gebeurt in
    // lowStockProducts (src/lib/cockpitBrief.ts).
    queryFn: () =>
      fetchAllRows<BriefStockProduct>((from, to) =>
        supabase
          .from('products')
          .select('id, name, stock, low_stock_threshold, track_inventory')
          .eq('tenant_id', tenantId!)
          .eq('track_inventory', true)
          .eq('is_active', true)
          .not('low_stock_threshold', 'is', null)
          .order('stock', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      ),
  });
}
