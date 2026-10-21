// DASH-2a — signalen voor de ochtendbrief die niets met omzet te maken hebben:
// de oudste openstaande verzending en producten die op raken.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { startOfDay } from 'date-fns';
import { fetchAllRows, isRevenueOrder, REAL_CUSTOMER_OR } from '@/lib/salesStats';
import type { BriefStockProduct } from '@/lib/cockpitBrief';

/** Betaald, nog niet verstuurd, en niet geannuleerd of geretourneerd. */
const OPEN_SHIPPING_STATUSES = ['pending', 'processing'] as const;

export function useCockpitShipping(enabled: boolean) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['cockpit-shipping', tenantId],
    enabled: enabled && !!tenantId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, count, error } = await supabase
        .from('orders')
        .select('created_at', { count: 'exact' })
        .eq('tenant_id', tenantId!)
        .eq('payment_status', 'paid')
        .eq('fulfillment_status', 'unfulfilled')
        .in('status', [...OPEN_SHIPPING_STATUSES])
        .order('created_at', { ascending: true })
        .limit(1);
      if (error) throw error;
      const oldest = data?.[0]?.created_at;
      return {
        openCount: count ?? 0,
        oldestAgeMs: oldest ? Math.max(0, Date.now() - new Date(oldest).getTime()) : null,
      };
    },
  });
}

export function useCockpitStock(enabled: boolean) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['cockpit-stock', tenantId],
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    // PostgREST kan stock niet met low_stock_threshold vergelijken: filteren gebeurt in
    // lowStockProducts (src/lib/cockpitBrief.ts).
    queryFn: () =>
      fetchAllRows<BriefStockProduct>((from, to) =>
        supabase
          .from('products')
          .select('id, name, stock, low_stock_threshold, track_inventory')
          .eq('tenant_id', tenantId!)
          .eq('track_inventory', true)
          .eq('is_active', true)
          .not('low_stock_threshold', 'is', null)
          .order('stock', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      ),
  });
}

// ------------------------------------------------------------------ DASH-2b

/** Nieuwe klanten vandaag (echte klanten, geen imports). Zelfde filter als de klantenrapporten. */
export function useCockpitNewCustomers(enabled: boolean) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['cockpit-new-customers', tenantId],
    enabled: enabled && !!tenantId,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId!)
        .or(REAL_CUSTOMER_OR)
        .gte('created_at', startOfDay(new Date()).toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Offertes die verstuurd zijn en nog geldig: wachten op antwoord van de klant. */
export function useCockpitOpenQuotes(enabled: boolean) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['cockpit-open-quotes', tenantId],
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId!)
        .eq('status', 'sent')
        .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export interface TopProduct {
  key: string;
  productId: string | null;
  name: string;
  image: string | null;
  quantity: number;
  revenue: number;
}

type TopOrderRow = {
  status: string | null;
  payment_status: string | null;
  order_items: { product_id: string | null; product_name: string | null; product_image: string | null; quantity: number | null; total_price: number | string | null }[] | null;
};
type TopPosRow = { items: unknown };

/**
 * Best verkochte producten sinds `since` (lokaal): webshop/marktplaats (betaalde orders) plus
 * kassatickets zonder order. Gesorteerd op aantal.
 */
export function useCockpitTopProducts(since: Date, enabled: boolean, limit = 5) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const sinceIso = since.toISOString();
  return useQuery({
    queryKey: ['cockpit-top-products', tenantId, sinceIso, limit],
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<TopProduct[]> => {
      const [orders, pos] = await Promise.all([
        fetchAllRows<TopOrderRow>((from, to) =>
          supabase
            .from('orders')
            .select('id, status, payment_status, order_items(product_id, product_name, product_image, quantity, total_price)')
            .eq('tenant_id', tenantId!)
            .gte('created_at', sinceIso)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to) as unknown as PromiseLike<{ data: TopOrderRow[] | null; error: unknown }>,
        ),
        fetchAllRows<TopPosRow>((from, to) =>
          supabase
            .from('pos_transactions')
            .select('id, items')
            .eq('tenant_id', tenantId!)
            .eq('status', 'completed')
            .is('order_id', null)
            .gte('created_at', sinceIso)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
        ),
      ]);
      const top = rankTopProducts(orders, pos).slice(0, limit);
      // Orderregels van marktplaatsen (bol) hebben vaak geen foto: val terug op de productfoto.
      const missing = top.filter((p) => !p.image && p.productId).map((p) => p.productId!);
      if (missing.length) {
        const { data } = await supabase.from('products').select('id, featured_image, images').in('id', missing);
        const byId = new Map((data ?? []).map((r) => [r.id, r.featured_image || r.images?.[0] || null]));
        for (const p of top) if (!p.image && p.productId) p.image = byId.get(p.productId) ?? null;
      }
      return top;
    },
  });
}

const toNum = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : 0;
  return Number.isFinite(n) ? n : 0;
};

/** Puur: telt orderregels (enkel omzet-orders) en kassaregels samen per product. */
export function rankTopProducts(orders: TopOrderRow[], pos: TopPosRow[]): TopProduct[] {
  const map = new Map<string, TopProduct>();
  const add = (productId: string | null, name: string | null, image: string | null, qty: number, revenue: number) => {
    if (!name && !productId) return;
    const key = productId ?? `name:${name}`;
    const row = map.get(key) ?? { key, productId, name: name ?? '', image: null, quantity: 0, revenue: 0 };
    row.quantity += qty;
    row.revenue = Math.round((row.revenue + revenue) * 100) / 100;
    if (!row.image && image) row.image = image;
    if (!row.name && name) row.name = name;
    map.set(key, row);
  };
  for (const o of orders) {
    if (!isRevenueOrder(o)) continue;
    for (const it of o.order_items ?? []) {
      add(it.product_id, it.product_name, it.product_image, toNum(it.quantity), toNum(it.total_price));
    }
  }
  for (const p of pos) {
    if (!Array.isArray(p.items)) continue;
    for (const raw of p.items) {
      if (!raw || typeof raw !== 'object') continue;
      const it = raw as Record<string, unknown>;
      add(
        typeof it.product_id === 'string' ? it.product_id : null,
        typeof it.name === 'string' ? it.name : null,
        typeof it.image_url === 'string' ? it.image_url : null,
        toNum(it.quantity),
        toNum(it.total),
      );
    }
  }
  return [...map.values()].filter((r) => r.quantity > 0).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
}

/**
 * Ongelezen inkomende berichten. Zelfde definitie als de inbox-badge (useUnreadMessagesCount:
 * inbound, read_at leeg), maar zonder eigen realtime-kanaal: verversen elke minuut.
 */
export function useCockpitUnread(enabled: boolean) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  return useQuery({
    queryKey: ['cockpit-unread', tenantId],
    enabled: enabled && !!tenantId,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('customer_messages')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId!)
        .eq('direction', 'inbound')
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
