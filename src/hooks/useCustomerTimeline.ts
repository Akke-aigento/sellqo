import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export interface TimelineEvent {
  id: string;
  type: 'order' | 'email_sent' | 'email_opened' | 'email_clicked' | 'wishlist' | 'pos' | 'message' | 'loyalty' | 'registration' | 'login';
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function useCustomerTimeline(customerId: string | undefined) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['customer-timeline', customerId, currentTenant?.id],
    queryFn: async (): Promise<TimelineEvent[]> => {
      if (!customerId || !currentTenant?.id) return [];

      const events: TimelineEvent[] = [];

      // Parallel fetch all data sources
      const [ordersRes, campaignSendsRes, favoritesRes, messagesRes, loyaltyRes, posRes] = await Promise.all([
        // Orders
        supabase
          .from('orders')
          .select('id, order_number, status, total, created_at, payment_status')
          .eq('customer_id', customerId)
          .eq('tenant_id', currentTenant.id)
          .order('created_at', { ascending: false })
          .limit(50),
        // Campaign sends (email activity)
        supabase
          .from('campaign_sends')
          .select('id, status, opened_at, clicked_at, sent_at, campaign_id')
          .eq('customer_id', customerId)
          .order('sent_at', { ascending: false })
          .limit(50),
        // Wishlist (storefront_favorites) - uses storefront_customer_id
        supabase
          .from('storefront_favorites')
          .select('id, product_id, created_at')
          .eq('tenant_id', currentTenant.id)
          .order('created_at', { ascending: false })
          .limit(30),
        // Messages
        supabase
          .from('customer_messages')
          .select('id, subject, direction, created_at, channel')
          .eq('customer_id', customerId)
          .eq('tenant_id', currentTenant.id)
          .order('created_at', { ascending: false })
          .limit(30),
        // Loyalty transactions (via customer_loyalty)
        supabase
          .from('loyalty_transactions')
          .select('id, points, transaction_type, description, created_at, customer_loyalty_id')
          .order('created_at', { ascending: false })
          .limit(30),
        // POS transactions
        supabase
          .from('pos_transactions')
          .select('id, receipt_number, total, status, created_at')
          .eq('customer_id', customerId)
          .eq('tenant_id', currentTenant.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      // Process orders
      for (const o of ordersRes.data ?? []) {
        events.push({
          id: `order-${o.id}`,
          type: 'order',
          title: `Bestelling ${o.order_number}`,
          description: `Status: ${o.status} — €${Number(o.total).toFixed(2)}`,
          timestamp: o.created_at,
          metadata: { order_id: o.id, status: o.status, total: o.total },
        });
      }

      // Process campaign sends
      for (const cs of campaignSendsRes.data ?? []) {
        if (cs.sent_at) {
          events.push({
            id: `email-sent-${cs.id}`,
            type: 'email_sent',
            title: 'E-mail verzonden',
            description: `Campagne-mail verstuurd`,
            timestamp: cs.sent_at,
          });
        }
        if (cs.opened_at) {
          events.push({
            id: `email-opened-${cs.id}`,
            type: 'email_opened',
            title: 'E-mail geopend',
            timestamp: cs.opened_at,
          });
        }
        if (cs.clicked_at) {
          events.push({
            id: `email-clicked-${cs.id}`,
            type: 'email_clicked',
            title: 'Link in e-mail geklikt',
            timestamp: cs.clicked_at,
          });
        }
      }

      // Process wishlist
      for (const f of favoritesRes.data ?? []) {
        events.push({
          id: `wishlist-${f.id}`,
          type: 'wishlist',
          title: 'Product aan wishlist toegevoegd',
          timestamp: f.created_at,
          metadata: { product_id: f.product_id },
        });
      }

      // Process messages
      for (const m of messagesRes.data ?? []) {
        events.push({
          id: `msg-${m.id}`,
          type: 'message',
          title: m.direction === 'inbound' ? 'Bericht ontvangen' : 'Bericht verstuurd',
          description: m.subject || `Via ${m.channel}`,
          timestamp: m.created_at,
        });
      }

      // Process loyalty
      for (const l of loyaltyRes.data ?? []) {
        events.push({
          id: `loyalty-${l.id}`,
          type: 'loyalty',
          title: `${l.transaction_type === 'earn' ? '+' : '-'}${l.points} loyaliteitspunten`,
          description: l.description || undefined,
          timestamp: l.created_at,
        });
      }

      // Process POS
      for (const p of posRes.data ?? []) {
        if (p.status === 'completed') {
          events.push({
            id: `pos-${p.id}`,
            type: 'pos',
            title: `POS Verkoop ${p.transaction_number || ''}`.trim(),
            description: `€${Number(p.total).toFixed(2)}`,
            timestamp: p.created_at,
          });
        }
      }

      // Sort by timestamp descending
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return events;
    },
    enabled: !!customerId && !!currentTenant?.id,
  });
}
