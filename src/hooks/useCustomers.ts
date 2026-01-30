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

  const createCustomer = useMutation({
    mutationFn: async (data: { 
      customer_type?: 'b2c' | 'b2b' | 'prospect';
      first_name: string; 
      last_name: string; 
      email: string; 
      phone?: string;
      company_name?: string;
      vat_number?: string;
      vat_verified?: boolean;
      billing_street?: string;
      billing_city?: string;
      billing_postal_code?: string;
      billing_country?: string;
      shipping_street?: string;
      shipping_city?: string;
      shipping_postal_code?: string;
      shipping_country?: string;
    }) => {
      if (!currentTenant?.id) throw new Error('Geen tenant geselecteerd');

      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          tenant_id: currentTenant.id,
          customer_type: data.customer_type || 'b2c',
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone || null,
          company_name: data.company_name || null,
          vat_number: data.vat_number || null,
          vat_verified: data.vat_verified || false,
          vat_verified_at: data.vat_verified ? new Date().toISOString() : null,
          billing_street: data.billing_street || null,
          billing_city: data.billing_city || null,
          billing_postal_code: data.billing_postal_code || null,
          billing_country: data.billing_country || 'NL',
          shipping_street: data.shipping_street || null,
          shipping_city: data.shipping_city || null,
          shipping_postal_code: data.shipping_postal_code || null,
          shipping_country: data.shipping_country || null,
        })
        .select()
        .single();

      if (error) throw error;
      return newCustomer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Klant aangemaakt' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij aanmaken', description: error.message, variant: 'destructive' });
    },
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
    createCustomer,
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
