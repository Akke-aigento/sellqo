// FOOD-2 — keukenscherm: webshoporders (orders met service_type) en kassa-/telefoonbonnen
// (kitchen_tickets zonder order) samengevoegd tot één lijst kaarten. Pure functies, zodat
// het samenvoegen en sorteren los te testen is.

export type KitchenStatus = 'new' | 'preparing' | 'ready' | 'done' | 'cancelled';
export type KitchenSource = 'webshop' | 'pos' | 'phone';
export type ServiceKind = 'pickup' | 'local_delivery' | 'eat_in';

export interface KitchenItem { quantity: number; name: string; detail: string | null; addons: string[] }
export interface KitchenCard {
  key: string;
  source: KitchenSource;
  orderId: string | null;
  ticketId: string | null;
  label: string;
  service: ServiceKind | null;
  requestedTime: string | null;
  createdAt: string;
  customer: string | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  items: KitchenItem[];
  total: number | null;
  paid: boolean;
  status: KitchenStatus;
  statusAt: string;
}

export interface OrderRow {
  id: string; order_number: string | null; created_at: string; service_type: string | null; requested_time: string | null;
  customer_name: string | null; customer_phone: string | null; notes: string | null; total: number | null;
  payment_status: string | null; payment_method: string | null; status: string | null;
  shipping_address: unknown;
  order_items: { product_name: string | null; variant_title: string | null; quantity: number | null; addons: unknown }[] | null;
}
export interface TicketRow {
  id: string; source: string; order_id: string | null; service_type: string | null; requested_time: string | null;
  customer_label: string | null; customer_phone: string | null; note: string | null; items: unknown; total: number | null;
  paid: boolean; status: string; status_at: string; created_at: string;
}

const asService = (s: string | null | undefined): ServiceKind | null =>
  s === 'pickup' || s === 'local_delivery' || s === 'eat_in' ? s : null;
const asStatus = (s: string | null | undefined): KitchenStatus =>
  s === 'preparing' || s === 'ready' || s === 'done' || s === 'cancelled' ? s : 'new';

function addonNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => (a && typeof a === 'object' && 'name' in a ? String((a as { name: unknown }).name ?? '') : '')).filter(Boolean);
}

/** De varianttitel van een webshopregel bevat ook de extra's ("Groot · Kaas, Ham"); toon die apart. */
function variantOnly(title: string | null, addons: string[]): string | null {
  if (!title) return null;
  if (!addons.length) return title;
  const suffix = addons.join(', ');
  if (title === suffix) return null;
  return title.endsWith(` · ${suffix}`) ? title.slice(0, -(suffix.length + 3)) || null : title;
}

function addressLine(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const street = [a.street, a.house_number].filter(Boolean).join(' ');
  const city = [a.postal_code, a.city].filter(Boolean).join(' ');
  return [street, city].filter(Boolean).join(', ') || null;
}

/** Webshoporder die in de keuken hoort: afhalen/leveren, niet geannuleerd, betaald of "betalen bij afhalen". */
export function orderBelongsInKitchen(o: OrderRow): boolean {
  if (!asService(o.service_type)) return false;
  if (o.status === 'cancelled') return false;
  return o.payment_status === 'paid' || o.payment_method === 'pay_on_pickup';
}

export function cardFromOrder(o: OrderRow, ticket: TicketRow | undefined): KitchenCard {
  return {
    key: `o:${o.id}`,
    source: 'webshop',
    orderId: o.id,
    ticketId: ticket?.id ?? null,
    label: o.order_number || o.id.slice(0, 6),
    service: asService(o.service_type),
    requestedTime: o.requested_time,
    createdAt: o.created_at,
    customer: o.customer_name,
    phone: o.customer_phone,
    address: o.service_type === 'local_delivery' ? addressLine(o.shipping_address) : null,
    note: o.notes,
    items: (o.order_items || []).map((i) => {
      const addons = addonNames(i.addons);
      return { quantity: Number(i.quantity) || 1, name: i.product_name || '', detail: variantOnly(i.variant_title, addons), addons };
    }),
    total: o.total != null ? Number(o.total) : null,
    paid: o.payment_status === 'paid',
    status: asStatus(ticket?.status),
    statusAt: ticket?.status_at || o.created_at,
  };
}

export function cardFromTicket(t: TicketRow): KitchenCard {
  const items = Array.isArray(t.items) ? (t.items as Record<string, unknown>[]) : [];
  return {
    key: `t:${t.id}`,
    source: t.source === 'phone' ? 'phone' : 'pos',
    orderId: null,
    ticketId: t.id,
    label: t.source === 'phone' ? 'Telefoon' : 'Kassa',
    service: asService(t.service_type),
    requestedTime: t.requested_time,
    createdAt: t.created_at,
    customer: t.customer_label,
    phone: t.customer_phone,
    address: null,
    note: t.note,
    items: items.map((i) => ({
      quantity: Number(i.quantity) || 1,
      name: String(i.name ?? ''),
      detail: i.variant ? String(i.variant) : null,
      addons: addonNames(i.addons),
    })),
    total: t.total != null ? Number(t.total) : null,
    paid: t.paid,
    status: asStatus(t.status),
    statusAt: t.status_at,
  };
}

/** Moment waarop de bestelling klaar moet zijn: gekozen tijd, anders besteltijd. */
export const dueAt = (c: KitchenCard) => new Date(c.requestedTime || c.createdAt).getTime();

/**
 * Wat staat er op het scherm? Open bonnen altijd; afgeronde alleen van de laatste
 * 12 uur (voor "terugzetten"). Een vooruitbestelling voor later dan `horizonMs`
 * verschijnt pas als ze dichterbij komt.
 */
export function buildBoard(orders: OrderRow[], tickets: TicketRow[], nowMs: number, horizonMs = 18 * 3600_000): KitchenCard[] {
  const byOrder = new Map(tickets.filter((t) => t.order_id).map((t) => [t.order_id as string, t]));
  const cards = [
    ...orders.filter(orderBelongsInKitchen).map((o) => cardFromOrder(o, byOrder.get(o.id))),
    ...tickets.filter((t) => !t.order_id).map(cardFromTicket),
  ];
  return cards
    .filter((c) => c.status !== 'cancelled')
    .filter((c) => (c.status === 'done' ? nowMs - new Date(c.statusAt).getTime() < 12 * 3600_000 : true))
    .filter((c) => dueAt(c) - nowMs < horizonMs)
    .sort((a, b) => dueAt(a) - dueAt(b));
}

export const NEXT_STATUS: Record<KitchenStatus, KitchenStatus | null> = {
  new: 'preparing', preparing: 'ready', ready: 'done', done: null, cancelled: null,
};
export const PREV_STATUS: Record<KitchenStatus, KitchenStatus | null> = {
  new: null, preparing: 'new', ready: 'preparing', done: 'ready', cancelled: null,
};

/** Minuten tot het afhaal-/levermoment (negatief = te laat). */
export const minutesLeft = (c: KitchenCard, nowMs: number) => Math.round((dueAt(c) - nowMs) / 60_000);
