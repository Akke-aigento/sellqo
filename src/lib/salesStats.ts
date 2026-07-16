// Eén plek voor alle verkoopstat-definities. Wijzig definities NOOIT lokaal in een component.
export type OrderLike = { status?: string | null; payment_status?: string | null };
export type ChannelLike = { marketplace_source?: string | null; sales_channel?: string | null };

/** Telt mee als bestelling (alles behalve geannuleerd). */
export const isCountableOrder = (o: OrderLike) => o.status !== 'cancelled';

/** Telt mee in omzet: betaald én niet geannuleerd. */
export const isRevenueOrder = (o: OrderLike) =>
  o.payment_status === 'paid' && o.status !== 'cancelled';

/**
 * Kanaalresolutie — identiek aan de regel in de Odoo-sync (CHANNEL-1):
 * marketplace_source is prioritair omdat sales_channel voor historische
 * marketplace-orders onbetrouwbaar is (33 oude Bol-orders staan als 'webshop').
 */
export const resolveOrderChannel = (o: ChannelLike): string => {
  if (
    o.marketplace_source &&
    o.marketplace_source !== 'web' &&
    o.marketplace_source !== 'shopify_draft_order'
  )
    return o.marketplace_source;
  if (o.marketplace_source === 'shopify_draft_order') return 'webshop';
  return o.sales_channel && o.sales_channel !== 'webshop' ? o.sales_channel : 'webshop';
};

/**
 * Haalt ALLE rijen op met expliciete paginering (Supabase default cap = 1000).
 * De builder krijgt from/to en moet een supabase query teruggeven met .range(from, to).
 */
export async function fetchAllRows<T>(
  buildQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // guard against runaway loops
  for (let i = 0; i < 1000; i++) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}