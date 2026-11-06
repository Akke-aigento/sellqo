// ZIJBALK-BESTELLINGEN-1 — moet Bestellingen uit de horeca-only-zijbalk? Enkel als online bestellen
// (afhalen/leveren) uit staat én de zaak nog geen enkele bestelling heeft. Regel: src/lib/horeca/onlineOrders.ts.
// Andere zaken (webshop, events, combinaties) vragen niets op: daar staat Bestellingen er altijd.
// Zolang de stand onbekend is (laden, leesfout) blijft het item staan: de pagina werkt sowieso.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useTracks } from '@/hooks/useBusinessModules';
import { isHorecaOnly } from '@/lib/tracks';
import { onlineOrdersOn, showOrdersInHorecaSidebar } from '@/lib/horeca/onlineOrders';

export const horecaOrdersNavKey = (tenantId: string | undefined) => ['horeca-orders-nav', tenantId] as const;

export function useHorecaOrdersNav(): { hideOrders: boolean } {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { hasTrack } = useTracks();
  const enabled = !!tenantId && isHorecaOnly(hasTrack);

  const { data } = useQuery({
    queryKey: horecaOrdersNavKey(tenantId),
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const id = tenantId!;
      const [ts, sm] = await Promise.all([
        supabase.from('tenant_theme_settings').select('use_custom_frontend, shop_live, shop_ordering').eq('tenant_id', id).maybeSingle(),
        supabase.from('shipping_methods').select('fulfillment_type').eq('tenant_id', id).eq('is_active', true),
      ]);
      if (ts.error) throw ts.error;
      if (sm.error) throw sm.error;
      const input = {
        customFrontend: ts.data?.use_custom_frontend === true,
        shopLive: ts.data ? ts.data.shop_live === true : null,
        shopOrdering: ts.data ? ts.data.shop_ordering === true : null,
        methods: (sm.data ?? []).map((m) => String(m.fulfillment_type || 'shipping')),
      };
      if (onlineOrdersOn(input)) return true;
      // Bestaan er al bestellingen (bv. van vroeger)? Eén id volstaat, geen telling.
      const o = await supabase.from('orders').select('id').eq('tenant_id', id).limit(1);
      if (o.error) throw o.error;
      return showOrdersInHorecaSidebar({ ...input, hasOrders: (o.data?.length ?? 0) > 0 });
    },
  });

  return { hideOrders: enabled && data === false };
}
