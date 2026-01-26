import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  owner_email: string;
  owner_name: string | null;
  phone: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  kvk_number: string | null;
  btw_number: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  currency: string | null;
  shipping_enabled: boolean | null;
  tax_percentage: number | null;
  custom_domain: string | null;
  stripe_account_id: string | null;
  last_login: string | null;
  created_at: string | null;
  updated_at: string | null;
  auto_generate_invoice: boolean | null;
  auto_send_invoice_email: boolean | null;
}

export interface TenantFormData {
  name: string;
  slug: string;
  owner_email: string;
  owner_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  kvk_number?: string;
  btw_number?: string;
  subscription_plan?: string;
  subscription_status?: string;
  currency?: string;
  tax_percentage?: number;
  shipping_enabled?: boolean;
  auto_generate_invoice?: boolean;
  auto_send_invoice_email?: boolean;
}

export function useTenants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tenantsQuery = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Tenant[];
    },
  });

  const createTenant = useMutation({
    mutationFn: async (data: TenantFormData) => {
      const { data: tenant, error } = await supabase
        .from('tenants')
        .insert({
          name: data.name,
          slug: data.slug,
          owner_email: data.owner_email,
          owner_name: data.owner_name || null,
          phone: data.phone || null,
          address: data.address || null,
          city: data.city || null,
          postal_code: data.postal_code || null,
          country: data.country || 'NL',
          kvk_number: data.kvk_number || null,
          btw_number: data.btw_number || null,
          subscription_plan: data.subscription_plan || 'starter',
          subscription_status: data.subscription_status || 'trial',
          currency: data.currency || 'EUR',
          tax_percentage: data.tax_percentage ?? 21,
          shipping_enabled: data.shipping_enabled ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({
        title: 'Tenant aangemaakt',
        description: 'De nieuwe tenant is succesvol aangemaakt.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateTenant = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TenantFormData> }) => {
      const { data: tenant, error } = await supabase
        .from('tenants')
        .update({
          name: data.name,
          slug: data.slug,
          owner_email: data.owner_email,
          owner_name: data.owner_name,
          phone: data.phone,
          address: data.address,
          city: data.city,
          postal_code: data.postal_code,
          country: data.country,
          kvk_number: data.kvk_number,
          btw_number: data.btw_number,
          subscription_plan: data.subscription_plan,
          subscription_status: data.subscription_status,
          currency: data.currency,
          tax_percentage: data.tax_percentage,
          shipping_enabled: data.shipping_enabled,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({
        title: 'Tenant bijgewerkt',
        description: 'De tenant is succesvol bijgewerkt.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteTenant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({
        title: 'Tenant verwijderd',
        description: 'De tenant is succesvol verwijderd.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    tenants: tenantsQuery.data ?? [],
    isLoading: tenantsQuery.isLoading,
    error: tenantsQuery.error,
    createTenant,
    updateTenant,
    deleteTenant,
  };
}
