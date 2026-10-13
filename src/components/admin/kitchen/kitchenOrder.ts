// FOOD-2 — keukeninfo die de kassa meegeeft (ter plaatse / meenemen / levering).
import type { POSCartItem } from '@/types/pos';

export type KitchenService = 'eat_in' | 'pickup' | 'local_delivery';
export interface KitchenOrderInput {
  enabled: boolean;
  service_type: KitchenService;
  /** null = zo snel mogelijk */
  requested_time: string | null;
  customer_label: string;
  customer_phone: string;
  note: string;
  /** Bestaande bon (telefonische bestelling die nu afgerekend wordt). */
  ticket_id: string | null;
}

export const defaultKitchenOrder = (enabled: boolean): KitchenOrderInput => ({
  enabled, service_type: 'pickup', requested_time: null, customer_label: '', customer_phone: '', note: '', ticket_id: null,
});

export const kitchenItems = (items: POSCartItem[]) =>
  items.map((i) => ({ name: i.name, quantity: i.quantity, addons: (i.addons || []).map((a) => ({ name: a.name })) }));
