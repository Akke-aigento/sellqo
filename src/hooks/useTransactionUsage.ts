import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TransactionUsage, TransactionUsageWithLimits } from '@/types/billing';

export function useTransactionUsage(tenantId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['transaction-usage', tenantId],
    queryFn: async (): Promise<TransactionUsageWithLimits> => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const currentMonthYear = new Date().toISOString().slice(0, 7); // YYYY-MM

      // Get current usage
      const { data: usageData, error: usageError } = await supabase
        .from('tenant_transaction_usage')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('month_year', currentMonthYear)
        .maybeSingle();

      if (usageError) throw usageError;

      // Get current subscription and plan
      const { data: subscriptionData, error: subError } = await supabase
        .from('tenant_subscriptions')
        .select(`
          *,
          pricing_plan:pricing_plans(*)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) throw subError;

      // Extract plan data - handle the raw database response
      const planData = subscriptionData?.pricing_plan as Record<string, unknown> | null;
      const includedTransactions = (planData?.included_transactions_monthly as number) ?? 0;
      const overageFee = (planData?.transaction_overage_fee as number) ?? 0.50;

      const usage = usageData as TransactionUsage | null;
      const totalTransactions = usage 
        ? usage.stripe_transactions + 
          usage.bank_transfer_transactions + 
          usage.pos_cash_transactions + 
          usage.pos_card_transactions
        : 0;

      // -1 means unlimited
      const isUnlimited = includedTransactions === -1;
      const remainingTransactions = isUnlimited 
        ? null 
        : Math.max(0, includedTransactions - totalTransactions);
      const isOverLimit = !isUnlimited && totalTransactions > includedTransactions;

      return {
        usage,
        total_transactions: totalTransactions,
        included_transactions: includedTransactions,
        remaining_transactions: remainingTransactions,
        is_over_limit: isOverLimit,
        overage_fee_per_transaction: overageFee,
      };
    },
    enabled: !!tenantId,
    staleTime: 30000, // 30 seconds
  });

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
