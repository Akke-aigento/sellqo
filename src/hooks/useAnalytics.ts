import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { startOfMonth, subMonths, format, eachDayOfInterval, subDays, startOfDay } from 'date-fns';

export interface DailyStats {
  date: string;
  revenue: number;
  orders: number;
  customers: number;
}

export interface OrderStatusStats {
  status: string;
  count: number;
}

export interface TopProduct {
  name: string;
  revenue: number;
  quantity: number;
}

export interface AnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValue: number;
  revenueChange: number;
  ordersChange: number;
  customersChange: number;
}

export function useAnalytics(days: number = 30) {
  const { currentTenant } = useTenant();

  const summaryQuery = useQuery({
    queryKey: ['analytics', 'summary', currentTenant?.id, days],
    queryFn: async (): Promise<AnalyticsSummary> => {
      if (!currentTenant) throw new Error('No tenant selected');

      const now = new Date();
      const startDate = subDays(startOfDay(now), days);
      const previousStartDate = subDays(startDate, days);

      // Current period stats
      const { data: currentOrders } = await supabase
        .from('orders')
        .select('total, payment_status')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', startDate.toISOString());

      const { data: previousOrders } = await supabase
        .from('orders')
        .select('total, payment_status')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString());

      const { count: currentCustomerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', startDate.toISOString());

      const { count: previousCustomerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString());

      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id);

      const currentRevenue = currentOrders
        ?.filter(o => o.payment_status === 'paid')
        .reduce((sum, o) => sum + Number(o.total), 0) ?? 0;

      const previousRevenue = previousOrders
        ?.filter(o => o.payment_status === 'paid')
        .reduce((sum, o) => sum + Number(o.total), 0) ?? 0;

      const currentOrderCount = currentOrders?.length ?? 0;
      const previousOrderCount = previousOrders?.length ?? 0;

      const revenueChange = previousRevenue > 0 
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
        : 0;
      const ordersChange = previousOrderCount > 0 
        ? ((currentOrderCount - previousOrderCount) / previousOrderCount) * 100 
        : 0;
      const customersChange = (previousCustomerCount ?? 0) > 0 
        ? (((currentCustomerCount ?? 0) - (previousCustomerCount ?? 0)) / (previousCustomerCount ?? 1)) * 100 
        : 0;

      return {
        totalRevenue: currentRevenue,
        totalOrders: currentOrderCount,
        totalCustomers: totalCustomers ?? 0,
        averageOrderValue: currentOrderCount > 0 ? currentRevenue / currentOrderCount : 0,
        revenueChange,
        ordersChange,
        customersChange,
      };
    },
    enabled: !!currentTenant,
  });

  const dailyStatsQuery = useQuery({
    queryKey: ['analytics', 'daily', currentTenant?.id, days],
    queryFn: async (): Promise<DailyStats[]> => {
      if (!currentTenant) throw new Error('No tenant selected');

      const now = new Date();
      const startDate = subDays(startOfDay(now), days);
      const dateRange = eachDayOfInterval({ start: startDate, end: now });

      const { data: orders } = await supabase
        .from('orders')
        .select('created_at, total, payment_status')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', startDate.toISOString());

      const { data: customers } = await supabase
        .from('customers')
        .select('created_at')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', startDate.toISOString());

      const dailyStats = dateRange.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOrders = orders?.filter(o => 
          format(new Date(o.created_at!), 'yyyy-MM-dd') === dateStr
        ) ?? [];
        const dayCustomers = customers?.filter(c => 
          format(new Date(c.created_at!), 'yyyy-MM-dd') === dateStr
        ) ?? [];

        return {
          date: format(date, 'dd MMM'),
          revenue: dayOrders
            .filter(o => o.payment_status === 'paid')
            .reduce((sum, o) => sum + Number(o.total), 0),
          orders: dayOrders.length,
          customers: dayCustomers.length,
        };
      });

      return dailyStats;
    },
    enabled: !!currentTenant,
  });

  const orderStatusQuery = useQuery({
    queryKey: ['analytics', 'orderStatus', currentTenant?.id],
    queryFn: async (): Promise<OrderStatusStats[]> => {
      if (!currentTenant) throw new Error('No tenant selected');

      const { data: orders } = await supabase
        .from('orders')
        .select('status')
        .eq('tenant_id', currentTenant.id);

      const statusCounts: Record<string, number> = {};
      orders?.forEach(order => {
        const status = order.status || 'pending';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      return Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
      }));
    },
    enabled: !!currentTenant,
  });

  const topProductsQuery = useQuery({
    queryKey: ['analytics', 'topProducts', currentTenant?.id],
    queryFn: async (): Promise<TopProduct[]> => {
      if (!currentTenant) throw new Error('No tenant selected');

      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          product_name,
          quantity,
          total_price,
          orders!inner(tenant_id, payment_status)
        `)
        .eq('orders.tenant_id', currentTenant.id)
        .eq('orders.payment_status', 'paid');

      const productStats: Record<string, { revenue: number; quantity: number }> = {};
      orderItems?.forEach(item => {
        if (!productStats[item.product_name]) {
          productStats[item.product_name] = { revenue: 0, quantity: 0 };
        }
        productStats[item.product_name].revenue += Number(item.total_price);
        productStats[item.product_name].quantity += item.quantity;
      });

      return Object.entries(productStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    },
    enabled: !!currentTenant,
  });

  return {
    summary: summaryQuery.data,
    dailyStats: dailyStatsQuery.data ?? [],
    orderStatus: orderStatusQuery.data ?? [],
    topProducts: topProductsQuery.data ?? [],
    isLoading: summaryQuery.isLoading || dailyStatsQuery.isLoading,
  };
}
