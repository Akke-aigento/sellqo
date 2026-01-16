import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export interface RevenueData {
  period: string;
  revenue: number;
  invoiceCount: number;
  averageOrderValue: number;
}

export interface TopCustomer {
  id: string;
  name: string;
  revenue: number;
  invoiceCount: number;
  averageOrderValue: number;
  percentageOfTotal: number;
}

export interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number;
  amount: number;
  invoiceCount: number;
  percentage: number;
}

export interface AgingInvoice {
  invoiceNumber: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  daysOverdue: number;
  reminderLevel: number;
}

export interface SubscriptionMetrics {
  mrr: number;
  arr: number;
  activeCount: number;
  byInterval: { interval: string; count: number; mrr: number }[];
}

export function useRevenueReport(startDate: string, endDate: string, granularity: 'day' | 'week' | 'month' = 'month') {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['revenue-report', tenantId, startDate, endDate, granularity],
    queryFn: async (): Promise<RevenueData[]> => {
      if (!tenantId) return [];

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('created_at, total')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .in('status', ['sent', 'paid']);

      if (error) throw error;

      // Group by period
      const grouped = new Map<string, { revenue: number; count: number }>();

      for (const invoice of invoices || []) {
        const date = new Date(invoice.created_at);
        let key: string;

        if (granularity === 'day') {
          key = date.toISOString().split('T')[0];
        } else if (granularity === 'week') {
          const startOfWeek = new Date(date);
          startOfWeek.setDate(date.getDate() - date.getDay());
          key = startOfWeek.toISOString().split('T')[0];
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        const existing = grouped.get(key) || { revenue: 0, count: 0 };
        existing.revenue += Number(invoice.total);
        existing.count += 1;
        grouped.set(key, existing);
      }

      return Array.from(grouped.entries())
        .map(([period, data]) => ({
          period,
          revenue: data.revenue,
          invoiceCount: data.count,
          averageOrderValue: data.count > 0 ? data.revenue / data.count : 0,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
    },
    enabled: !!tenantId,
  });
}

export function useTopCustomersReport(startDate: string, endDate: string, limit: number = 10) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['top-customers-report', tenantId, startDate, endDate, limit],
    queryFn: async (): Promise<TopCustomer[]> => {
      if (!tenantId) return [];

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          total,
          customer:customers(id, first_name, last_name, company_name)
        `)
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59')
        .in('status', ['sent', 'paid']);

      if (error) throw error;

      // Group by customer
      const grouped = new Map<string, { name: string; revenue: number; count: number }>();
      let totalRevenue = 0;

      for (const invoice of invoices || []) {
        if (!invoice.customer) continue;
        
        const customerId = invoice.customer.id;
        const customerName = invoice.customer.company_name || 
          `${invoice.customer.first_name || ''} ${invoice.customer.last_name || ''}`.trim() ||
          'Onbekend';
        
        const existing = grouped.get(customerId) || { name: customerName, revenue: 0, count: 0 };
        existing.revenue += Number(invoice.total);
        existing.count += 1;
        totalRevenue += Number(invoice.total);
        grouped.set(customerId, existing);
      }

      return Array.from(grouped.entries())
        .map(([id, data]) => ({
          id,
          name: data.name,
          revenue: data.revenue,
          invoiceCount: data.count,
          averageOrderValue: data.count > 0 ? data.revenue / data.count : 0,
          percentageOfTotal: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
    },
    enabled: !!tenantId,
  });
}

export function useAgingReport() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['aging-report', tenantId],
    queryFn: async (): Promise<{ buckets: AgingBucket[]; invoices: AgingInvoice[]; totalOutstanding: number }> => {
      if (!tenantId) return { buckets: [], invoices: [], totalOutstanding: 0 };

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          invoice_number,
          total,
          created_at,
          due_date,
          reminder_level,
          customer:customers(first_name, last_name, company_name)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'sent')
        .is('paid_at', null);

      if (error) throw error;

      const today = new Date();
      const bucketDefs = [
        { label: '0-30 dagen', minDays: 0, maxDays: 30 },
        { label: '31-60 dagen', minDays: 31, maxDays: 60 },
        { label: '61-90 dagen', minDays: 61, maxDays: 90 },
        { label: '90+ dagen', minDays: 91, maxDays: 999999 },
      ];

      const bucketData = bucketDefs.map(b => ({ ...b, amount: 0, invoiceCount: 0 }));
      const agingInvoices: AgingInvoice[] = [];
      let totalOutstanding = 0;

      for (const invoice of invoices || []) {
        const dueDate = invoice.due_date ? new Date(invoice.due_date) : new Date(invoice.created_at);
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        const amount = Number(invoice.total);
        totalOutstanding += amount;

        const customerName = invoice.customer?.company_name || 
          `${invoice.customer?.first_name || ''} ${invoice.customer?.last_name || ''}`.trim() ||
          'Onbekend';

        agingInvoices.push({
          invoiceNumber: invoice.invoice_number,
          customerName,
          issueDate: invoice.created_at,
          dueDate: invoice.due_date || invoice.created_at,
          amount,
          daysOverdue,
          reminderLevel: invoice.reminder_level || 0,
        });

        for (const bucket of bucketData) {
          if (daysOverdue >= bucket.minDays && daysOverdue <= bucket.maxDays) {
            bucket.amount += amount;
            bucket.invoiceCount += 1;
            break;
          }
        }
      }

      const buckets: AgingBucket[] = bucketData.map(b => ({
        ...b,
        percentage: totalOutstanding > 0 ? (b.amount / totalOutstanding) * 100 : 0,
      }));

      return {
        buckets,
        invoices: agingInvoices.sort((a, b) => b.daysOverdue - a.daysOverdue),
        totalOutstanding,
      };
    },
    enabled: !!tenantId,
  });
}

export function useSubscriptionMetrics() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['subscription-metrics', tenantId],
    queryFn: async (): Promise<SubscriptionMetrics> => {
      if (!tenantId) return { mrr: 0, arr: 0, activeCount: 0, byInterval: [] };

      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select('interval, total')
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      if (error) throw error;

      const byInterval = new Map<string, { count: number; mrr: number }>();
      let totalMrr = 0;

      for (const sub of subscriptions || []) {
        const interval = sub.interval;
        let monthlyValue: number;

        switch (interval) {
          case 'weekly':
            monthlyValue = Number(sub.total) * 4.33;
            break;
          case 'monthly':
            monthlyValue = Number(sub.total);
            break;
          case 'quarterly':
            monthlyValue = Number(sub.total) / 3;
            break;
          case 'yearly':
            monthlyValue = Number(sub.total) / 12;
            break;
          default:
            monthlyValue = Number(sub.total);
        }

        totalMrr += monthlyValue;

        const existing = byInterval.get(interval) || { count: 0, mrr: 0 };
        existing.count += 1;
        existing.mrr += monthlyValue;
        byInterval.set(interval, existing);
      }

      return {
        mrr: totalMrr,
        arr: totalMrr * 12,
        activeCount: subscriptions?.length || 0,
        byInterval: Array.from(byInterval.entries()).map(([interval, data]) => ({
          interval,
          count: data.count,
          mrr: data.mrr,
        })),
      };
    },
    enabled: !!tenantId,
  });
}
