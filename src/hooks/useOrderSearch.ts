import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useState, useEffect } from 'react';

export function useOrderSearchForReturn(searchQuery: string) {
  const { currentTenant } = useTenant();
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return useQuery({
    queryKey: ['order-search-return', currentTenant?.id, debouncedQuery],
    queryFn: async () => {
      if (!currentTenant?.id || !debouncedQuery || debouncedQuery.length < 2) return [];
      
      const cleanQuery = debouncedQuery.replace(/^#/, '').trim();
      if (!cleanQuery) return [];

      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_email, total, status, payment_status, created_at, source, marketplace_connection_id, shipping_cost, subtotal, discount_amount, discount_code')
        .eq('tenant_id', currentTenant.id)
        .or(`order_number.ilike.%${cleanQuery}%,customer_name.ilike.%${cleanQuery}%,customer_email.ilike.%${cleanQuery}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id && debouncedQuery.length >= 2,
  });
}
