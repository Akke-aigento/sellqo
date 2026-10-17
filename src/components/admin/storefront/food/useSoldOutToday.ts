// HORECA-CHANNELS-1 — "op voor vandaag" aan/uit. De database rekent de reset uit
// (volgende ochtend 05:00, Brussel) via set_product_sold_out_today; RLS bepaalt wie het mag.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

export const isSoldOutNow = (soldOutUntil: string | null | undefined) =>
  !!soldOutUntil && new Date(soldOutUntil).getTime() > Date.now();

export function useSoldOutToday() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, soldOut }: { productId: string; soldOut: boolean }) => {
      const { data, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: string | null; error: unknown }>)(
        'set_product_sold_out_today', { p_product_id: productId, p_sold_out: soldOut },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      toast.success(t(v.soldOut ? 'admin.storefront.food.sold_out_on' : 'admin.storefront.food.sold_out_off'));
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product-channels', v.productId] });
    },
    onError: () => toast.error(t('admin.storefront.food.save_failed')),
  });
}
