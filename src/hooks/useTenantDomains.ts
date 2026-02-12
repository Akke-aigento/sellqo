import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

export interface TenantDomain {
  id: string;
  tenant_id: string;
  domain: string;
  locale: string;
  is_canonical: boolean;
  is_active: boolean;
  dns_verified: boolean;
  verification_token: string | null;
  ssl_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useTenantDomains() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const { data: domains = [], isLoading } = useQuery({
    queryKey: ['tenant-domains', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_domains')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('is_canonical', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as TenantDomain[];
    },
    enabled: !!tenantId,
  });

  const addDomain = useMutation({
    mutationFn: async (params: { domain: string; locale: string; is_canonical?: boolean }) => {
      const { data, error } = await supabase
        .from('tenant_domains')
        .insert({
          tenant_id: tenantId!,
          domain: params.domain.toLowerCase().trim(),
          locale: params.locale,
          is_canonical: params.is_canonical ?? false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-domains', tenantId] });
      toast.success('Domein toegevoegd');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Dit domein is al in gebruik');
      } else {
        toast.error('Fout bij toevoegen domein');
      }
    },
  });

  const updateDomain = useMutation({
    mutationFn: async (params: { id: string; updates: Partial<Pick<TenantDomain, 'locale' | 'is_canonical' | 'is_active'>> }) => {
      const { error } = await supabase
        .from('tenant_domains')
        .update(params.updates)
        .eq('id', params.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-domains', tenantId] });
      toast.success('Domein bijgewerkt');
    },
    onError: () => {
      toast.error('Fout bij bijwerken domein');
    },
  });

  const removeDomain = useMutation({
    mutationFn: async (domainId: string) => {
      const { error } = await supabase
        .from('tenant_domains')
        .delete()
        .eq('id', domainId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-domains', tenantId] });
      toast.success('Domein verwijderd');
    },
    onError: () => {
      toast.error('Fout bij verwijderen domein');
    },
  });

  // Get unique locales from active domains
  const activeLocales = [...new Set(domains.filter(d => d.is_active).map(d => d.locale))];

  // Get canonical domain
  const canonicalDomain = domains.find(d => d.is_canonical);

  return {
    domains,
    isLoading,
    addDomain,
    updateDomain,
    removeDomain,
    activeLocales,
    canonicalDomain,
  };
}
