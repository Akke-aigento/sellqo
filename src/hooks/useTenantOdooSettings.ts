import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TenantOdooSettings {
  tenant_id: string;
  aggregate_b2c_customers: boolean;
  b2c_dummy_partner_name: string;
  b2c_dummy_partner_odoo_id: number | null;
  aggregate_per_channel: boolean;
}

export function useTenantOdooSettings(tenantId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tenant_odoo_settings', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<TenantOdooSettings | null> => {
      const { data, error } = await supabase
        .from('tenant_odoo_settings')
        .select('*')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return (data as TenantOdooSettings) ?? null;
    },
  });

  const upsert = useMutation({
    mutationFn: async (updates: Partial<Omit<TenantOdooSettings, 'tenant_id' | 'b2c_dummy_partner_odoo_id'>>) => {
      if (!tenantId) throw new Error('tenant_id required');
      const payload = { tenant_id: tenantId, ...updates };
      const { data, error } = await supabase
        .from('tenant_odoo_settings')
        .upsert(payload, { onConflict: 'tenant_id' })
        .select()
        .single();
      if (error) throw error;
      return data as TenantOdooSettings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_odoo_settings', tenantId] });
      toast.success('Odoo-instellingen opgeslagen');
    },
    onError: (err: Error) => toast.error(err.message || 'Opslaan mislukt'),
  });

  return { settings: query.data, isLoading: query.isLoading, upsert };
}