import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import type { ShippingIntegration, ShippingIntegrationFormData, ShippingProvider } from '@/types/shippingIntegration';

export function useShippingIntegrations() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: integrations = [], isLoading, error } = useQuery({
    queryKey: ['shipping-integrations', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('shipping_integrations')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ShippingIntegration[];
    },
    enabled: !!currentTenant?.id,
  });

  const createIntegration = useMutation({
    mutationFn: async (formData: ShippingIntegrationFormData) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const { data, error } = await supabase
        .from('shipping_integrations')
        .insert([{
          tenant_id: currentTenant.id,
          provider: formData.provider,
          display_name: formData.display_name,
          api_key: formData.api_key || null,
          api_secret: formData.api_secret || null,
          is_active: formData.is_active,
          is_default: formData.is_default,
          settings: (formData.settings || {}) as Record<string, never>,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-integrations'] });
      toast({
        title: 'Integratie aangemaakt',
        description: 'De verzendintegratie is succesvol toegevoegd.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij aanmaken',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateIntegration = useMutation({
    mutationFn: async ({ id, ...formData }: Partial<ShippingIntegrationFormData> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      
      if (formData.display_name !== undefined) updateData.display_name = formData.display_name;
      if (formData.api_key !== undefined) updateData.api_key = formData.api_key || null;
      if (formData.api_secret !== undefined) updateData.api_secret = formData.api_secret || null;
      if (formData.is_active !== undefined) updateData.is_active = formData.is_active;
      if (formData.is_default !== undefined) updateData.is_default = formData.is_default;
      if (formData.settings !== undefined) updateData.settings = formData.settings;

      const { error } = await supabase
        .from('shipping_integrations')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-integrations'] });
      toast({
        title: 'Integratie bijgewerkt',
        description: 'De wijzigingen zijn opgeslagen.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij bijwerken',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteIntegration = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shipping_integrations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-integrations'] });
      toast({
        title: 'Integratie verwijderd',
        description: 'De verzendintegratie is verwijderd.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij verwijderen',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const testConnection = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('test-shipping-connection', {
        body: { integration_id: id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Verbinding geslaagd',
        description: 'De API verbinding werkt correct.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Verbinding mislukt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('shipping_integrations')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-integrations'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getActiveIntegration = (): ShippingIntegration | undefined => {
    return integrations.find(i => i.is_active && i.is_default) || 
           integrations.find(i => i.is_active);
  };

  const getIntegrationByProvider = (provider: ShippingProvider): ShippingIntegration | undefined => {
    return integrations.find(i => i.provider === provider);
  };

  return {
    integrations,
    isLoading,
    error,
    createIntegration: createIntegration.mutateAsync,
    updateIntegration: updateIntegration.mutateAsync,
    deleteIntegration: deleteIntegration.mutateAsync,
    testConnection: testConnection.mutateAsync,
    toggleActive: toggleActive.mutateAsync,
    isCreating: createIntegration.isPending,
    isUpdating: updateIntegration.isPending,
    isDeleting: deleteIntegration.isPending,
    isTesting: testConnection.isPending,
    getActiveIntegration,
    getIntegrationByProvider,
  };
}
