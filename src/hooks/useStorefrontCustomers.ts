import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export interface StorefrontCustomer {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company_name: string | null;
  vat_number: string | null;
  newsletter_opted_in: boolean | null;
  marketing_consent: boolean | null;
  is_active: boolean | null;
  created_at: string;
  last_login_at: string | null;
}

export function useStorefrontCustomers(search?: string) {
  const { currentTenant } = useTenant();

  const { data, isLoading, error } = useQuery({
    queryKey: ['storefront-customers', currentTenant?.id, search],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('storefront_customers')
        .select('id, tenant_id, email, first_name, last_name, phone, company_name, vat_number, newsletter_opted_in, marketing_consent, is_active, created_at, last_login_at')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as StorefrontCustomer[];
    },
    enabled: !!currentTenant?.id,
  });

  return { storefrontCustomers: data ?? [], isLoading, error };
}
