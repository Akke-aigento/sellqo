import type { OrderStatus } from '@/types/order';

/**
 * Mirror van de TRANSITIONS-matrix in
 * supabase/functions/update-order-fulfillment-status/index.ts.
 * Houd beide synchroon: dit bestand is de gedeelde bron voor frontend UX.
 * `returned` en `partially_returned` lopen via de returns-module en zijn
 * hier bewust afgesloten.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  returned: [],
  partially_returned: [],
};

export const ALL_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'partially_returned',
];

export function getValidNextStatuses(current: OrderStatus): OrderStatus[] {
  return [current, ...(ORDER_STATUS_TRANSITIONS[current] ?? [])];
}