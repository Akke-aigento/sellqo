// DASH-2b — "Net binnen": de laatste gebeurtenissen van de winkel in één lijst. Geen realtime
// (WAL-listeners kosten DB-credits): verversen elke minuut en bij terugkeer naar het venster.
// Elke bron is los: zonder leesrecht of bij een fout valt alleen die bron weg.
import { useQuery } from '@tanstack/react-query';
import { subHours } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { isRevenueOrder, REAL_CUSTOMER_OR, resolveOrderChannel } from '@/lib/salesStats';

export type FeedKind = 'order' | 'pos' | 'customer' | 'review' | 'checkin';

export interface FeedItem {
  id: string;
  kind: FeedKind;
  at: string;
  /** Klant-, auteur- of deelnemersnaam; null als onbekend. */
  name: string | null;
  amount: number | null;
  channel: string | null;
  /** Ordernummer of bonnummer. */
  ref: string | null;
  rating: number | null;
  /** Interne link (adminroute) of null. */
  href: string | null;
}

export interface FeedSources {
  orders: boolean;
  pos: boolean;
  customers: boolean;
  reviews: boolean;
  checkins: boolean;
}

const WINDOW_HOURS = 48;
const PER_SOURCE = 8;

const num = (v: unknown) => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Puur: samenvoegen en sorteren, nieuwste eerst. */
export function mergeFeed(groups: FeedItem[][], limit: number): FeedItem[] {
  return groups
    .flat()
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || a.id.localeCompare(b.id))
    .slice(0, limit);
}

async function safe<T>(enabled: boolean, run: () => Promise<T[]>): Promise<T[]> {
  if (!enabled) return [];
  try {
    return await run();
  } catch {
    return [];
  }
}

export function useCockpitFeed(sources: FeedSources, limit = 6) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const any = Object.values(sources).some(Boolean);

  return useQuery({
    queryKey: ['cockpit-feed', tenantId, sources, limit],
    enabled: any && !!tenantId,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const since = subHours(new Date(), WINDOW_HOURS).toISOString();

      const orders = safe<FeedItem>(sources.orders, async () => {
        const { data, error } = await supabase
          .from('orders')
          .select('id, created_at, order_number, customer_name, total, status, payment_status, marketplace_source, sales_channel')
          .eq('tenant_id', tenantId!)
          .eq('payment_status', 'paid')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(PER_SOURCE);
        if (error) throw error;
        return (data ?? []).filter(isRevenueOrder).map((o) => ({
          id: `order:${o.id}`,
          kind: 'order' as const,
          at: o.created_at,
          name: o.customer_name,
          amount: num(o.total),
          channel: resolveOrderChannel(o),
          ref: o.order_number,
          rating: null,
          href: `/admin/orders/${o.id}`,
        }));
      });

      const pos = safe<FeedItem>(sources.pos, async () => {
        const { data, error } = await supabase
          .from('pos_transactions')
          .select('id, created_at, total, receipt_number')
          .eq('tenant_id', tenantId!)
          .eq('status', 'completed')
          .is('order_id', null)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(PER_SOURCE);
        if (error) throw error;
        return (data ?? []).map((p) => ({
          id: `pos:${p.id}`,
          kind: 'pos' as const,
          at: p.created_at,
          name: null,
          amount: num(p.total),
          channel: 'pos',
          ref: p.receipt_number,
          rating: null,
          href: null,
        }));
      });

      const customers = safe<FeedItem>(sources.customers, async () => {
        const { data, error } = await supabase
          .from('customers')
          .select('id, created_at, first_name, last_name, company_name')
          .eq('tenant_id', tenantId!)
          .or(REAL_CUSTOMER_OR)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(PER_SOURCE);
        if (error) throw error;
        return (data ?? []).map((c) => ({
          id: `customer:${c.id}`,
          kind: 'customer' as const,
          at: c.created_at,
          name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.company_name || null,
          amount: null,
          channel: null,
          ref: null,
          rating: null,
          href: `/admin/customers/${c.id}`,
        }));
      });

      const reviews = safe<FeedItem>(sources.reviews, async () => {
        const { data, error } = await supabase
          .from('external_reviews')
          .select('id, created_at, review_date, author_name, rating')
          .eq('tenant_id', tenantId!)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(PER_SOURCE);
        if (error) throw error;
        return (data ?? []).map((r) => ({
          id: `review:${r.id}`,
          kind: 'review' as const,
          at: r.created_at,
          name: r.author_name,
          amount: null,
          channel: null,
          ref: null,
          rating: r.rating,
          href: null,
        }));
      });

      const checkins = safe<FeedItem>(sources.checkins, async () => {
        const { data, error } = await supabase
          .from('ticket_instances')
          .select('id, checked_in_at, attendee_name')
          .eq('tenant_id', tenantId!)
          .not('checked_in_at', 'is', null)
          .gte('checked_in_at', since)
          .order('checked_in_at', { ascending: false })
          .limit(PER_SOURCE);
        if (error) throw error;
        return (data ?? []).map((ti) => ({
          id: `checkin:${ti.id}`,
          kind: 'checkin' as const,
          at: ti.checked_in_at as string,
          name: ti.attendee_name,
          amount: null,
          channel: null,
          ref: null,
          rating: null,
          href: null,
        }));
      });

      return mergeFeed(await Promise.all([orders, pos, customers, reviews, checkins]), limit);
    },
  });
}
