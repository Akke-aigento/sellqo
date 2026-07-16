import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { startOfDay, subDays } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

export interface LiveFeedItem {
  id: string;
  type: 'order_new' | 'order_shipped' | 'order_delivered' | 'customer_new' | 'review_new';
  icon: string;
  message: string;
  timestamp: Date;
  amount?: number;
  metadata?: Record<string, unknown>;
}

export interface TodayStats {
  revenue: number;
  revenueChange: number;
  orderCount: number;
  orderCountChange: number;
  newCustomers: number;
  newCustomersChange: number;
}

interface UseTodayLiveFeedReturn {
  feedItems: LiveFeedItem[];
  todayStats: TodayStats;
  isConnected: boolean;
  isLoading: boolean;
}

const MAX_FEED_ITEMS = 20;

const getIconForType = (type: LiveFeedItem['type']): string => {
  switch (type) {
    case 'order_new': return '💰';
    case 'order_shipped': return '📦';
    case 'order_delivered': return '✅';
    case 'customer_new': return '👋';
    case 'review_new': return '⭐';
    default: return '📌';
  }
};

const formatCustomerName = (order: any): string => {
  const name = order.customer_name || order.customer_email;
  if (name) {
    const parts = name.split(' ');
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
    }
    return parts[0];
  }
  return 'Anonieme klant';
};

export function useTodayLiveFeed(): UseTodayLiveFeedReturn {
  const { currentTenant } = useTenant();
  const [feedItems, setFeedItems] = useState<LiveFeedItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [todayStats, setTodayStats] = useState<TodayStats>({
    revenue: 0,
    revenueChange: 0,
    orderCount: 0,
    orderCountChange: 0,
    newCustomers: 0,
    newCustomersChange: 0,
  });

  const tenantId = currentTenant?.id;

  const addFeedItem = useCallback((item: LiveFeedItem) => {
    setFeedItems(prev => {
      const newItems = [item, ...prev].slice(0, MAX_FEED_ITEMS);
      return newItems;
    });
  }, []);

  // Compute stats for a day window (paid, non-cancelled revenue; non-cancelled order count; new customers).
  const fetchStatsForWindow = useCallback(
    async (startISO: string, endISO: string) => {
      const [revenueRes, orderCountRes, customerCountRes] = await Promise.all([
        supabase
          .from('orders')
          .select('total')
          .eq('tenant_id', tenantId!)
          .eq('payment_status', 'paid')
          .neq('status', 'cancelled')
          .gte('created_at', startISO)
          .lt('created_at', endISO),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!)
          .neq('status', 'cancelled')
          .gte('created_at', startISO)
          .lt('created_at', endISO),
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!)
          .gte('created_at', startISO)
          .lt('created_at', endISO),
      ]);
      const revenue = (revenueRes.data ?? []).reduce(
        (sum, o: { total: number | null }) => sum + Number(o.total || 0),
        0,
      );
      return {
        revenue,
        orderCount: orderCountRes.count ?? 0,
        newCustomers: customerCountRes.count ?? 0,
      };
    },
    [tenantId],
  );

  const refreshStats = useCallback(async () => {
    if (!tenantId) return;
    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayStart = startOfDay(subDays(now, 1));
    const [today, yesterday] = await Promise.all([
      fetchStatsForWindow(todayStart.toISOString(), new Date(todayStart.getTime() + 24 * 60 * 60 * 1000).toISOString()),
      fetchStatsForWindow(yesterdayStart.toISOString(), todayStart.toISOString()),
    ]);
    const revenueChange =
      yesterday.revenue > 0
        ? Math.round(((today.revenue - yesterday.revenue) / yesterday.revenue) * 100)
        : today.revenue > 0
          ? 100
          : 0;
    setTodayStats({
      revenue: today.revenue,
      revenueChange,
      orderCount: today.orderCount,
      orderCountChange: today.orderCount - yesterday.orderCount,
      newCustomers: today.newCustomers,
      newCustomersChange: today.newCustomers - yesterday.newCustomers,
    });
  }, [tenantId, fetchStatsForWindow]);

  // Fetch today's feed items (feed decoupled from stats).
  useEffect(() => {
    if (!tenantId) return;

    const fetchData = async () => {
      setIsLoading(true);
      const todayStart = startOfDay(new Date()).toISOString();

      try {
        const [ordersRes, customersRes] = await Promise.all([
          supabase
            .from('orders')
            .select('id, order_number, total, customer_name, customer_email, status, created_at, shipped_at, delivered_at, payment_status')
            .eq('tenant_id', tenantId)
            .gte('created_at', todayStart)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('customers')
            .select('id, first_name, last_name, email, created_at')
            .eq('tenant_id', tenantId)
            .gte('created_at', todayStart)
            .order('created_at', { ascending: false })
            .limit(10),
        ]);

        // Map orders to feed items
        const orderItems: LiveFeedItem[] = (ordersRes.data || []).flatMap(order => {
          const items: LiveFeedItem[] = [];
          const customerName = formatCustomerName(order);

          // New order
          items.push({
            id: `order-new-${order.id}`,
            type: 'order_new',
            icon: getIconForType('order_new'),
            message: `${formatCurrency(order.total)} bestelling van ${customerName}`,
            timestamp: new Date(order.created_at),
            amount: order.total,
            metadata: { orderId: order.id, orderNumber: order.order_number },
          });

          // Shipped
          if (order.shipped_at) {
            items.push({
              id: `order-shipped-${order.id}`,
              type: 'order_shipped',
              icon: getIconForType('order_shipped'),
              message: `Bestelling ${order.order_number} verzonden`,
              timestamp: new Date(order.shipped_at),
              metadata: { orderId: order.id, orderNumber: order.order_number },
            });
          }

          // Delivered
          if (order.delivered_at) {
            items.push({
              id: `order-delivered-${order.id}`,
              type: 'order_delivered',
              icon: getIconForType('order_delivered'),
              message: `Bestelling ${order.order_number} afgeleverd`,
              timestamp: new Date(order.delivered_at),
              metadata: { orderId: order.id, orderNumber: order.order_number },
            });
          }

          return items;
        });

        // Map customers to feed items
        const customerItems: LiveFeedItem[] = (customersRes.data || []).map(customer => {
          const name = customer.first_name 
            ? `${customer.first_name}${customer.last_name ? ` ${customer.last_name.charAt(0)}.` : ''}`
            : 'Nieuwe klant';
          return {
            id: `customer-${customer.id}`,
            type: 'customer_new',
            icon: getIconForType('customer_new'),
            message: `${name} heeft zich geregistreerd`,
            timestamp: new Date(customer.created_at),
            metadata: { customerId: customer.id },
          };
        });

        // Combine and sort by timestamp
        const allItems = [...orderItems, ...customerItems]
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, MAX_FEED_ITEMS);

        setFeedItems(allItems);
      } catch (error) {
        console.error('Error fetching today data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    refreshStats();
  }, [tenantId, refreshStats]);

  // Setup realtime subscriptions
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`today-live-feed-${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const order = payload.new as any;
          const customerName = formatCustomerName(order);
          addFeedItem({
            id: `order-new-${order.id}-${Date.now()}`,
            type: 'order_new',
            icon: getIconForType('order_new'),
            message: `${formatCurrency(order.total)} bestelling van ${customerName}`,
            timestamp: new Date(),
            amount: order.total,
            metadata: { orderId: order.id, orderNumber: order.order_number },
          });
          refreshStats();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const order = payload.new as any;
          const oldOrder = payload.old as any;
          
          // Check if shipped_at was just set
          if (order.shipped_at && !oldOrder.shipped_at) {
            addFeedItem({
              id: `order-shipped-${order.id}-${Date.now()}`,
              type: 'order_shipped',
              icon: getIconForType('order_shipped'),
              message: `Bestelling ${order.order_number} verzonden`,
              timestamp: new Date(),
              metadata: { orderId: order.id, orderNumber: order.order_number },
            });
          }
          
          // Check if delivered_at was just set
          if (order.delivered_at && !oldOrder.delivered_at) {
            addFeedItem({
              id: `order-delivered-${order.id}-${Date.now()}`,
              type: 'order_delivered',
              icon: getIconForType('order_delivered'),
              message: `Bestelling ${order.order_number} afgeleverd`,
              timestamp: new Date(),
              metadata: { orderId: order.id, orderNumber: order.order_number },
            });
          }
          refreshStats();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'customers', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const customer = payload.new as any;
          const name = customer.first_name 
            ? `${customer.first_name}${customer.last_name ? ` ${customer.last_name.charAt(0)}.` : ''}`
            : 'Nieuwe klant';
          addFeedItem({
            id: `customer-${customer.id}-${Date.now()}`,
            type: 'customer_new',
            icon: getIconForType('customer_new'),
            message: `${name} heeft zich geregistreerd`,
            timestamp: new Date(),
            metadata: { customerId: customer.id },
          });
          refreshStats();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, addFeedItem, refreshStats]);

  return {
    feedItems,
    todayStats,
    isConnected,
    isLoading,
  };
}
