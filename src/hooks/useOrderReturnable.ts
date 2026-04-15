import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useOrderReturnable(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order-returnable', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_order_returnable_items', {
        _order_id: orderId!,
      });
      if (error) throw error;
      const map = new Map<string, { ordered: number; alreadyReturned: number; returnable: number }>();
      (data || []).forEach((row: any) => {
        map.set(row.order_item_id, {
          ordered: row.ordered_quantity,
          alreadyReturned: row.already_returned,
          returnable: row.returnable_quantity,
        });
      });
      return map;
    },
  });
}
