// FOOD-2 — keukenscherm: webshoporders (orders met service_type) en kassa-/telefoonbonnen
// (kitchen_tickets zonder order) samengevoegd tot één lijst kaarten. Pure functies, zodat
// het samenvoegen en sorteren los te testen is.

export type KitchenStatus = 'new' | 'preparing' | 'ready' | 'done' | 'cancelled';
export type KitchenSource = 'webshop' | 'pos' | 'phone' | 'table';
export type ServiceKind = 'pickup' | 'local_delivery' | 'eat_in';

export interface KitchenItem {
  quantity: number; name: string;
  /** Variant/formaat ("Groot"). */
  detail: string | null;
  addons: string[];
  /** KEUKEN-VEILIG-1: opmerking bij deze lijn ("zonder ui"); los van de variant, zodat ze nooit wegvalt. */
  note: string | null;
  /** KEUKEN-VEILIG-1: EU-allergenen (codes) van het product en de extra's. */
  allergens: string[];
}
export interface KitchenCard {
  key: string;
  source: KitchenSource;
  orderId: string | null;
  ticketId: string | null;
  label: string;
  /** HORECA-1: tafelnummer bij bestellen aan tafel (de UI zet er "Tafel" voor, vertaald). */
  table: string | null;
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
  /** FOOD-3: klant al gemaild (klaar/onderweg). */
  notified: boolean;
  /** TAFEL-1: bereidingspost (keuken, bar, …) van een tafelronde; null = geen post. */
  stationId: string | null;
  /** KEUKEN-VEILIG-1: rekening van een tafel-/toogbon (voor "klaar" op het zaalplan). */
  checkId?: string | null;
}

export interface OrderRow {
  id: string; order_number: string | null; created_at: string; service_type: string | null; requested_time: string | null;
  customer_name: string | null; customer_phone: string | null; notes: string | null; total: number | null;
  payment_status: string | null; payment_method: string | null; status: string | null;
  shipping_address: unknown;
  table_label?: string | null;
  order_items: { product_name: string | null; variant_title: string | null; quantity: number | null; addons: unknown;
    /** KEUKEN-VEILIG-1: allergenen van het product (join products). */
    products?: { allergens: string[] | null } | null }[] | null;
}
export interface TicketRow {
  id: string; source: string; order_id: string | null; service_type: string | null; requested_time: string | null;
  customer_label: string | null; customer_phone: string | null; note: string | null; items: unknown; total: number | null;
  paid: boolean; status: string; status_at: string; created_at: string; notified_at?: string | null;
  /** TAFEL-1: ronde van een tafelrekening (één bon per station). */
  table_label?: string | null; station_id?: string | null; round_id?: string | null; check_id?: string | null;
}

const asService = (s: string | null | undefined): ServiceKind | null =>
  s === 'pickup' || s === 'local_delivery' || s === 'eat_in' ? s : null;
const asStatus = (s: string | null | undefined): KitchenStatus =>
  s === 'preparing' || s === 'ready' || s === 'done' || s === 'cancelled' ? s : 'new';

/** KEUKEN-VEILIG-1 — allergeencodes uit een jsonb-array (onbekende vormen = geen). */
export function allergenCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((a): a is string => typeof a === 'string' && a.length > 0))].sort();
}

/** KEUKEN-VEILIG-1 — allergenen van een hele bon (voor de samenvatting bovenaan). */
export const cardAllergens = (c: KitchenCard): string[] =>
  [...new Set(c.items.filter((i) => i.quantity > 0).flatMap((i) => i.allergens))].sort();

/** KEUKEN-VEILIG-1b — option_id's van de gekozen extra's van een webshopregel (storefront ChosenAddon). */
export function addonOptionIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => (a && typeof a === 'object' && 'option_id' in a ? String((a as { option_id: unknown }).option_id ?? '') : '')).filter(Boolean);
}

/** Allergenen per extra (option_id → codes), uit product_addon_options. */
export type AddonAllergens = ReadonlyMap<string, string[]>;

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

export function cardFromOrder(o: OrderRow, ticket: TicketRow | undefined, addonAllergens?: AddonAllergens): KitchenCard {
  return {
    key: `o:${o.id}`,
    source: 'webshop',
    orderId: o.id,
    ticketId: ticket?.id ?? null,
    label: o.order_number || o.id.slice(0, 6),
    service: asService(o.service_type),
    requestedTime: o.requested_time,
    createdAt: o.created_at,
    table: o.table_label || null,
    // Aan tafel zonder naam zet de webshop "Tafel 4" als klantnaam; dat toont de UI al via `table`.
    customer: o.table_label && o.customer_name === `Tafel ${o.table_label}` ? null : o.customer_name,
    phone: o.customer_phone,
    address: o.service_type === 'local_delivery' ? addressLine(o.shipping_address) : null,
    note: o.notes,
    items: (o.order_items || []).map((i) => {
      const addons = addonNames(i.addons);
      return {
        quantity: Number(i.quantity) || 1, name: i.product_name || '', detail: variantOnly(i.variant_title, addons), addons,
        // KEUKEN-VEILIG-1b: ook de allergenen van de gekozen extra's (zoals aan de kassa en via de QR).
        note: null, allergens: allergenCodes([...(i.products?.allergens ?? []), ...addonOptionIds(i.addons).flatMap((id) => addonAllergens?.get(id) ?? [])]),
      };
    }),
    total: o.total != null ? Number(o.total) : null,
    paid: o.payment_status === 'paid',
    status: asStatus(ticket?.status),
    statusAt: ticket?.status_at || o.created_at,
    notified: !!ticket?.notified_at,
    stationId: null,
  };
}

export function cardFromTicket(t: TicketRow): KitchenCard {
  const items = Array.isArray(t.items) ? (t.items as Record<string, unknown>[]) : [];
  const source: KitchenSource = t.source === 'phone' ? 'phone' : t.source === 'table' ? 'table' : 'pos';
  return {
    key: `t:${t.id}`,
    source,
    orderId: null,
    ticketId: t.id,
    label: source,
    // TAFEL-1: een ronde van een tafel; customer_label is dan de tafel of de naam van de rekening.
    table: source === 'table' ? t.table_label || null : null,
    service: asService(t.service_type),
    requestedTime: t.requested_time,
    createdAt: t.created_at,
    customer: source === 'table' && t.table_label && t.customer_label === t.table_label ? null : t.customer_label,
    phone: t.customer_phone,
    address: null,
    note: t.note,
    items: items.map((i) => {
      // TAFEL-1: opmerking per lijn ("zonder ui") en annuleringen (negatief aantal) uit een ronde.
      // KEUKEN-VEILIG-1: variant en opmerking apart (vroeger won de variant en viel de opmerking weg).
      // De algemene QR-opmerking staat sinds KEUKEN-VEILIG-1 op de bon zelf (t.note); op lijn 1 staat
      // dezelfde tekst nog eens: daar niet herhalen.
      const note = i.note ? String(i.note) : null;
      return {
        quantity: Number(i.quantity) || 1,
        name: String(i.name ?? ''),
        detail: i.variant ? String(i.variant) : null,
        addons: addonNames(i.addons),
        note: note && note !== t.note ? note : null,
        allergens: allergenCodes(i.allergens),
      };
    }),
    total: t.total != null ? Number(t.total) : null,
    paid: t.paid,
    status: asStatus(t.status),
    statusAt: t.status_at,
    notified: !!t.notified_at,
    stationId: t.station_id ?? null,
    checkId: t.check_id ?? null,
  };
}

/** KEUKEN-VEILIG-1 — rekeningen met een bon die klaar staat om op te dienen (zaalplan). */
export const readyCheckIds = (cards: KitchenCard[]): Set<string> =>
  new Set(cards.filter((c) => c.status === 'ready' && c.checkId).map((c) => c.checkId as string));

/** Moment waarop de bestelling klaar moet zijn: gekozen tijd, anders besteltijd. */
export const dueAt = (c: KitchenCard) => new Date(c.requestedTime || c.createdAt).getTime();

/**
 * Wat staat er op het scherm? Open bonnen altijd; afgeronde alleen van de laatste
 * 12 uur (voor "terugzetten"). Een vooruitbestelling voor later dan `horizonMs`
 * verschijnt pas als ze dichterbij komt.
 */
export function buildBoard(orders: OrderRow[], tickets: TicketRow[], nowMs: number, horizonMs = 18 * 3600_000, addonAllergens?: AddonAllergens): KitchenCard[] {
  const byOrder = new Map(tickets.filter((t) => t.order_id).map((t) => [t.order_id as string, t]));
  const cards = [
    ...orders.filter(orderBelongsInKitchen).map((o) => cardFromOrder(o, byOrder.get(o.id), addonAllergens)),
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

/**
 * KEUKEN-VEILIG-1 — de barpost: één tik en de bon is klaar én opgediend (een drankje maak je en geef
 * je mee; "in bereiding" voegt niets toe). Wat nog op "in bereiding" of "klaar" stond, ook in één tik.
 * Terug zet een afgewerkte bon weer op nieuw. De keuken houdt NEXT_STATUS/PREV_STATUS.
 */
export const BAR_NEXT_STATUS: Record<KitchenStatus, KitchenStatus | null> = {
  new: 'done', preparing: 'done', ready: 'done', done: null, cancelled: null,
};
export const BAR_PREV_STATUS: Record<KitchenStatus, KitchenStatus | null> = {
  new: null, preparing: 'new', ready: 'new', done: 'new', cancelled: null,
};

/** KEUKEN-VEILIG-1 — welke stappen een bon doorloopt: keuken (nieuw → in bereiding → klaar → opgediend) of bar (één tik). */
export type KitchenFlow = 'kitchen' | 'bar';
export const flowNext = (c: Pick<KitchenCard, 'status'>, flow: KitchenFlow = 'kitchen') => (flow === 'bar' ? BAR_NEXT_STATUS : NEXT_STATUS)[c.status];
export const flowPrev = (c: Pick<KitchenCard, 'status'>, flow: KitchenFlow = 'kitchen') => (flow === 'bar' ? BAR_PREV_STATUS : PREV_STATUS)[c.status];

/** FOOD-3 — welke klik verwittigt de webshopklant? Klaar bij afhalen, meegegeven bij levering. */
export function notifiesCustomer(card: KitchenCard, status: KitchenStatus): boolean {
  if (!card.orderId || card.notified) return false;
  return (card.service === 'pickup' && status === 'ready') || (card.service === 'local_delivery' && status === 'done');
}

/** Minuten tot het afhaal-/levermoment (negatief = te laat). */
export const minutesLeft = (c: KitchenCard, nowMs: number) => Math.round((dueAt(c) - nowMs) / 60_000);

/** Na hoeveel minuten wachten een bon zonder gekozen tijd (kassa, QR, telefoon, tafel) te laat is. */
export const ASAP_LATE_MIN = 20;
/** Aan de bar gaat het sneller: een drankbon die 10 minuten wacht, is te laat. */
export const BAR_LATE_MIN = 10;

/**
 * KEUKEN-VEILIG-1 — te laat, voor élke bon: met een gekozen tijd (webshop) zodra die voorbij is,
 * zonder (kassa, QR, telefoon) na `asapMin` minuten wachten. Een klare of afgewerkte bon is nooit te laat.
 */
export function isLate(c: KitchenCard, nowMs: number, asapMin = ASAP_LATE_MIN): boolean {
  if (c.status === 'ready' || c.status === 'done' || c.status === 'cancelled') return false;
  const m = minutesLeft(c, nowMs);
  return c.requestedTime ? m < 0 : -m >= asapMin;
}

/**
 * TAFEL-1 — bonnen voor één bereidingspost. `null` = alles. Bonnen zonder post (webshop,
 * oude kassa, telefoon) horen bij de standaardpost; zonder standaardpost zie je ze overal.
 */
export function cardsForStation(cards: KitchenCard[], stationId: string | null, defaultStationId: string | null): KitchenCard[] {
  if (!stationId) return cards;
  return cards.filter((c) => c.stationId === stationId || (!c.stationId && (!defaultStationId || stationId === defaultStationId)));
}
