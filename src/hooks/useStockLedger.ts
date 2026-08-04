import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type StockMovementReason =
  | 'sale' | 'return' | 'purchase' | 'sync' | 'manual' | 'opening' | 'adjustment';

export interface StockMovement {
  id: string;
  tenant_id: string;
  product_id: string;
  variant_id: string | null;
  delta: number;
  balance_after: number;
  reason: StockMovementReason;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

/** Movement history for a product (or a specific variant when variantId is given). */
export function useStockMovements(
  productId: string | null | undefined,
  variantId?: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ['stock-movements', productId, variantId ?? null],
    enabled: Boolean(productId) && enabled,
    queryFn: async (): Promise<StockMovement[]> => {
      let query = supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', productId!)
        .order('created_at', { ascending: false })
        .limit(200);

      if (variantId) query = query.eq('variant_id', variantId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as StockMovement[];
    },
  });
}

/**
 * Manual stock correction: never writes `stock` directly — it goes through the
 * ledger RPC so every mutation is recorded (reason 'manual').
 */
export function useSetStockManual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      variantId = null,
      oldStock,
      newStock,
      note,
    }: {
      productId: string;
      variantId?: string | null;
      oldStock: number;
      newStock: number;
      note?: string | null;
    }) => {
      const delta = Math.round(newStock) - Math.round(oldStock);
      if (delta === 0) return null;

      const { data, error } = await supabase.rpc('record_stock_movement', {
        p_tenant_id: null,
        p_product_id: variantId ? null : productId,
        p_variant_id: variantId,
        p_delta: delta,
        p_reason: 'manual',
        p_reference_type: null,
        p_reference_id: null,
        p_note: note ?? null,
        p_created_by: null,
      });
      if (error) throw error;
      return data as number | null;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-variants'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['stock-report'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
