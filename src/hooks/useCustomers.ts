import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import type { Customer } from '@/types/order';

export function useCustomers(search?: string) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers, isLoading, error, refetch } = useQuery({
    queryKey: ['customers', currentTenant?.id, search],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!currentTenant?.id,
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ customerId, data }: { customerId: string; data: Partial<Customer> }) => {
      const { error } = await supabase
        .from('customers')
        .update(data)
        .eq('id', customerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Klant bijgewerkt' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij bijwerken', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: async (customerId: string) => {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Klant verwijderd' });
    },
    onError: (error) => {
      toast({ title: 'Fout bij verwijderen', description: error.message, variant: 'destructive' });
    },
  });

  return {
    customers: customers ?? [],
    isLoading,
    error,
    refetch,
    updateCustomer,
    deleteCustomer,
  };
}

export function useCustomer(customerId: string | undefined) {
  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      if (!customerId) return null;

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;
      return data as Customer;
    },
    enabled: !!customerId,
  });

  return { customer, isLoading, error };
}

export function useCustomerOrders(customerId: string | undefined) {
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: async () => {
      if (!customerId) return [];

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  return { orders: orders ?? [], isLoading, error };
}
