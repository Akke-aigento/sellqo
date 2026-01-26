import { useState, useEffect, useMemo, useCallback } from 'react';
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
  reviewCount: number;
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
  const [yesterdayStats, setYesterdayStats] = useState({ revenue: 0, orderCount: 0, newCustomers: 0 });

  const tenantId = currentTenant?.id;

  const addFeedItem = useCallback((item: LiveFeedItem) => {
    setFeedItems(prev => {
      const newItems = [item, ...prev].slice(0, MAX_FEED_ITEMS);
      return newItems;
    });
  }, []);

  // Fetch today's existing events and yesterday's stats
  useEffect(() => {
    if (!tenantId) return;

    const fetchData = async () => {
      setIsLoading(true);
      const todayStart = startOfDay(new Date()).toISOString();
      const yesterdayStart = startOfDay(subDays(new Date(), 1)).toISOString();

      try {
        // Fetch today's orders, customers, reviews in parallel
        const [ordersRes, customersRes, yesterdayOrdersRes, yesterdayCustomersRes] = await Promise.all([
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
          supabase
            .from('orders')
            .select('total, payment_status')
            .eq('tenant_id', tenantId)
            .gte('created_at', yesterdayStart)
            .lt('created_at', todayStart)
            .eq('payment_status', 'paid'),
          supabase
            .from('customers')
            .select('id')
            .eq('tenant_id', tenantId)
            .gte('created_at', yesterdayStart)
            .lt('created_at', todayStart),
        ]);

        // Calculate yesterday stats
        const yesterdayRevenue = yesterdayOrdersRes.data?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
        const yesterdayOrderCount = yesterdayOrdersRes.data?.length || 0;
        const yesterdayNewCustomers = yesterdayCustomersRes.data?.length || 0;
        setYesterdayStats({ revenue: yesterdayRevenue, orderCount: yesterdayOrderCount, newCustomers: yesterdayNewCustomers });

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
  }, [tenantId]);

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
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, addFeedItem]);

  // Calculate today stats from feed items
  const todayStats = useMemo((): TodayStats => {
    const orderItems = feedItems.filter(item => item.type === 'order_new');
    const customerItems = feedItems.filter(item => item.type === 'customer_new');
    const reviewItems = feedItems.filter(item => item.type === 'review_new');

    const revenue = orderItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const orderCount = orderItems.length;
    const newCustomers = customerItems.length;
    const reviewCount = reviewItems.length;

    // Calculate changes vs yesterday
    const revenueChange = yesterdayStats.revenue > 0 
      ? Math.round(((revenue - yesterdayStats.revenue) / yesterdayStats.revenue) * 100)
      : revenue > 0 ? 100 : 0;
    const orderCountChange = orderCount - yesterdayStats.orderCount;
    const newCustomersChange = newCustomers - yesterdayStats.newCustomers;

    return {
      revenue,
      revenueChange,
      orderCount,
      orderCountChange,
      newCustomers,
      newCustomersChange,
      reviewCount,
    };
  }, [feedItems, yesterdayStats]);

  return {
    feedItems,
    todayStats,
    isConnected,
    isLoading,
  };
}
