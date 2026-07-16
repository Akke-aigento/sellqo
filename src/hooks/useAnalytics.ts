import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { startOfMonth, subMonths, format, eachDayOfInterval, subDays, startOfDay } from 'date-fns';
import { fetchAllRows } from '@/lib/salesStats';

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

      // Revenue (paid + not cancelled) — paginated.
      const currentRevenueRows = await fetchAllRows<{ total: number }>((from, to) =>
        supabase
          .from('orders')
          .select('total')
          .eq('tenant_id', currentTenant.id)
          .eq('payment_status', 'paid')
          .neq('status', 'cancelled')
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })
          .range(from, to),
      );
      const previousRevenueRows = await fetchAllRows<{ total: number }>((from, to) =>
        supabase
          .from('orders')
          .select('total')
          .eq('tenant_id', currentTenant.id)
          .eq('payment_status', 'paid')
          .neq('status', 'cancelled')
          .gte('created_at', previousStartDate.toISOString())
          .lt('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })
          .range(from, to),
      );

      // Order counts (excluding cancelled).
      const [
        currentOrderCountRes,
        previousOrderCountRes,
        currentCustomerCountRes,
        previousCustomerCountRes,
      ] = await Promise.all([
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .neq('status', 'cancelled')
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .neq('status', 'cancelled')
          .gte('created_at', previousStartDate.toISOString())
          .lt('created_at', startDate.toISOString()),
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', startDate.toISOString()),
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', previousStartDate.toISOString())
          .lt('created_at', startDate.toISOString()),
      ]);

      const currentRevenue = currentRevenueRows.reduce((sum, o) => sum + Number(o.total), 0);
      const previousRevenue = previousRevenueRows.reduce((sum, o) => sum + Number(o.total), 0);
      const currentOrderCount = currentOrderCountRes.count ?? 0;
      const previousOrderCount = previousOrderCountRes.count ?? 0;
      const currentCustomerCount = currentCustomerCountRes.count ?? 0;
      const previousCustomerCount = previousCustomerCountRes.count ?? 0;

      // Average order value uses the SAME set as the revenue numerator: paid + not-cancelled.
      const revenueOrderCount = currentRevenueRows.length;

      const revenueChange = previousRevenue > 0 
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
        : 0;
      const ordersChange = previousOrderCount > 0 
        ? ((currentOrderCount - previousOrderCount) / previousOrderCount) * 100 
        : 0;
      const customersChange = previousCustomerCount > 0
        ? ((currentCustomerCount - previousCustomerCount) / previousCustomerCount) * 100
        : 0;

      return {
        totalRevenue: currentRevenue,
        totalOrders: currentOrderCount,
        totalCustomers: currentCustomerCount,
        averageOrderValue: revenueOrderCount > 0 ? currentRevenue / revenueOrderCount : 0,
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

      const orders = await fetchAllRows<{ created_at: string; total: number; payment_status: string | null; status: string | null }>(
        (from, to) =>
          supabase
            .from('orders')
            .select('created_at, total, payment_status, status')
            .eq('tenant_id', currentTenant.id)
            .neq('status', 'cancelled')
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false })
            .range(from, to),
      );

      const customers = await fetchAllRows<{ created_at: string }>((from, to) =>
        supabase
          .from('customers')
          .select('created_at')
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })
          .range(from, to),
      );

      const dailyStats = dateRange.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOrders = orders.filter(o =>
          format(new Date(o.created_at!), 'yyyy-MM-dd') === dateStr
        );
        const dayCustomers = customers.filter(c =>
          format(new Date(c.created_at!), 'yyyy-MM-dd') === dateStr
        );

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
    queryKey: ['analytics', 'orderStatus', currentTenant?.id, days],
    queryFn: async (): Promise<OrderStatusStats[]> => {
      if (!currentTenant) throw new Error('No tenant selected');

      const startDate = subDays(startOfDay(new Date()), days);
      const orders = await fetchAllRows<{ status: string | null }>((from, to) =>
        supabase
          .from('orders')
          .select('status')
          .eq('tenant_id', currentTenant.id)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })
          .range(from, to),
      );

      const statusCounts: Record<string, number> = {};
      orders.forEach(order => {
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
    queryKey: ['analytics', 'topProducts', currentTenant?.id, days],
    queryFn: async (): Promise<TopProduct[]> => {
      if (!currentTenant) throw new Error('No tenant selected');

      const startDate = subDays(startOfDay(new Date()), days);
      const orderItems = await fetchAllRows<{
        product_name: string;
        quantity: number;
        total_price: number;
        orders: { tenant_id: string; payment_status: string; status: string; created_at: string } | null;
      }>((from, to) =>
        supabase
          .from('order_items')
          .select(`
          product_name,
          quantity,
          total_price,
          orders!inner(tenant_id, payment_status, status, created_at)
        `)
          .eq('orders.tenant_id', currentTenant.id)
          .eq('orders.payment_status', 'paid')
          .neq('orders.status', 'cancelled')
          .gte('orders.created_at', startDate.toISOString())
          .order('id', { ascending: false })
          .range(from, to),
      );

      const productStats: Record<string, { revenue: number; quantity: number }> = {};
      orderItems.forEach(item => {
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
