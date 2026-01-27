import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MerchantTransaction {
  id: string;
  type: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  status: string;
  description: string | null;
  created: number;
  available_on: number;
  source_type: string | null;
}

export interface MerchantPayout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  method: string;
  arrival_date: number;
  created: number;
  description: string | null;
  failure_message: string | null;
}

export interface MerchantBalance {
  available: number;
  pending: number;
  currency: string;
}

export interface PayoutSchedule {
  interval: string;
  delay_days: number;
  weekly_anchor?: string;
  monthly_anchor?: number;
}

export function useMerchantTransactions(limit = 50) {
  return useQuery({
    queryKey: ['merchant-transactions', limit],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-merchant-transactions', {
        body: null,
      });
      
      if (error) throw error;
      
      return data as {
        transactions: MerchantTransaction[];
        has_more: boolean;
        balance: MerchantBalance;
        message?: string;
      };
    },
  });
}

export function useMerchantPayouts(limit = 20) {
  return useQuery({
    queryKey: ['merchant-payouts', limit],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-merchant-payouts', {
        body: null,
      });
      
      if (error) throw error;
      
      return data as {
        payouts: MerchantPayout[];
        has_more: boolean;
        schedule: PayoutSchedule | null;
        message?: string;
      };
    },
  });
}

// Calculate summary stats from local orders for bank transfers
export function useBankTransferStats(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['bank-transfer-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return { total: 0, count: 0 };
      
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('orders')
        .select('total')
        .eq('tenant_id', tenantId)
        .eq('payment_method', 'bank_transfer')
        .eq('payment_status', 'paid')
        .gte('created_at', startOfMonth.toISOString());
      
      if (error) throw error;
      
      const total = data?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
      
      return {
        total,
        count: data?.length || 0,
      };
    },
    enabled: !!tenantId,
  });
}
