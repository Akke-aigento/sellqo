import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithErrorBody } from '@/lib/invokeWithErrorBody';
import { useTenant } from './useTenant';

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
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['merchant-transactions', tenantId, limit],
    enabled: !!tenantId,
    queryFn: async () => {
      // Er ging geen tenant en geen limiet mee. De functie leidde de tenant af
      // uit een query die RLS blokkeerde, en las de limiet uit een querystring
      // die bij `functions.invoke` niet bestaat — die kwam dus nooit aan.
      // `invokeWithErrorBody` en niet `functions.invoke`: die laatste gooit een
      // kaal FunctionsHttpError, en `String(error)` in Payments.tsx maakt daar
      // "Edge Function returned a non-2xx status code" van. De `{ error: ... }`
      // die de functie wél teruggeeft — een rolfout, een ontbrekende sleutel,
      // een Stripe-melding — werd weggegooid, waardoor elke storing hier alleen
      // met een logexport te diagnosticeren was.
      return await invokeWithErrorBody<{
        transactions: MerchantTransaction[];
        has_more: boolean;
        balance: MerchantBalance;
        message?: string;
      }>('get-merchant-transactions', { body: { tenant_id: tenantId, limit } });
    },
  });
}

export function useMerchantPayouts(limit = 20) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['merchant-payouts', tenantId, limit],
    enabled: !!tenantId,
    queryFn: async () => {
      // Zie de noot bij useMerchantTransactions voor invokeWithErrorBody.
      return await invokeWithErrorBody<{
        payouts: MerchantPayout[];
        has_more: boolean;
        schedule: PayoutSchedule | null;
        message?: string;
      }>('get-merchant-payouts', { body: { tenant_id: tenantId, limit } });
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
