import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TenantPrintfulSettings {
  tenant_id: string;
  printful_sync_enabled: boolean;
  auto_forward_orders: boolean;
  forward_on_payment_status: string;
  auto_confirm: boolean;
}

export function useTenantPrintfulSettings(tenantId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tenant_printful_settings', tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<TenantPrintfulSettings | null> => {
      const { data, error } = await supabase
        .from('tenant_printful_settings')
        .select('*')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return (data as TenantPrintfulSettings) ?? null;
    },
  });

  const upsert = useMutation({
    mutationFn: async (updates: Partial<Omit<TenantPrintfulSettings, 'tenant_id'>>) => {
      if (!tenantId) throw new Error('tenant_id required');
      const { data, error } = await supabase
        .from('tenant_printful_settings')
        .upsert({ tenant_id: tenantId, ...updates }, { onConflict: 'tenant_id' })
        .select()
        .single();
      if (error) throw error;
      return data as TenantPrintfulSettings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_printful_settings', tenantId] });
      toast.success('Printful-instellingen opgeslagen');
    },
    onError: (err: Error) => toast.error(err.message || 'Opslaan mislukt'),
  });

  return { settings: query.data, isLoading: query.isLoading, upsert };
}