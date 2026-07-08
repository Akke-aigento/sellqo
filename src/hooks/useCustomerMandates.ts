import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type MandateStatus = 'pending' | 'active' | 'revoked' | 'failed';

export interface CustomerMandate {
  id: string;
  tenant_id: string;
  customer_id: string;
  stripe_customer_id: string;
  stripe_payment_method_id: string;
  method_type: 'sepa_debit' | 'card';
  status: MandateStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Loads all mandates for the current tenant. RLS scopes to tenant automatically.
 */
export function useCustomerMandates() {
  return useQuery({
    queryKey: ['customer-payment-mandates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_payment_mandates')
        .select('*');
      if (error) throw error;
      return (data ?? []) as CustomerMandate[];
    },
  });
}