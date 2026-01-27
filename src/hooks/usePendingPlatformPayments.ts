import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

interface PendingPlatformPayment {
  id: string;
  tenant_id: string;
  ogm_reference: string;
  amount: number;
  currency: string;
  payment_type: 'subscription' | 'addon' | 'ai_credits';
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
  credits_amount: number | null;
  package_id: string | null;
  addon_type: string | null;
  created_at: string;
  expires_at: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  notes: string | null;
}

export function usePendingPlatformPayments() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['pending-platform-payments', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('pending_platform_payments')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PendingPlatformPayment[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useAllPendingPlatformPayments() {
  return useQuery({
    queryKey: ['all-pending-platform-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_platform_payments')
        .select(`
          *,
          tenants:tenant_id (
            id,
            name,
            slug
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}
