// Shared helper: log a stock movement to the stock_movements ledger from an
// edge function. Uses a service-role Supabase client (RLS-bypassing insert is
// intentional — clients cannot insert directly).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

export type StockLedgerReason =
  | 'sale' | 'return' | 'purchase' | 'sync' | 'manual' | 'opening' | 'adjustment';

export interface LogStockMovementArgs {
  tenantId: string;
  productId: string;
  variantId?: string | null;
  oldStock: number | null | undefined;
  newStock: number | null | undefined;
  reason: StockLedgerReason;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
}

/**
 * Logs a movement for a stock value that was already written (e.g. a
 * marketplace sync that overwrites stock). No-op when nothing changed.
 */
export async function logStockMovement(
  supabase: SupabaseClient,
  args: LogStockMovementArgs,
): Promise<void> {
  const oldStock = Math.round(args.oldStock ?? 0);
  const newStock = Math.round(args.newStock ?? 0);
  const delta = newStock - oldStock;
  if (delta === 0) return;

  const { error } = await supabase.from('stock_movements').insert({
    tenant_id: args.tenantId,
    product_id: args.productId,
    variant_id: args.variantId ?? null,
    delta,
    balance_after: newStock,
    reason: args.reason,
    reference_type: args.referenceType ?? null,
    reference_id: args.referenceId ?? null,
    note: args.note ?? null,
  });

  if (error) {
    console.error('logStockMovement failed:', error.message ?? JSON.stringify(error));
  }
}
