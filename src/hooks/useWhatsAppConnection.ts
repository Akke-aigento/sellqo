import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

export interface WhatsAppConnection {
  id: string;
  tenant_id: string;
  phone_number_id: string;
  business_account_id: string;
  display_phone_number: string;
  verified_name: string | null;
  webhook_verify_token: string;
  is_active: boolean;
  quality_rating: string | null;
  messaging_limit: string | null;
  connected_at: string;
  updated_at: string;
}

interface ConnectWhatsAppInput {
  phone_number_id: string;
  business_account_id: string;
  display_phone_number: string;
  verified_name?: string;
  access_token: string;
}

export function useWhatsAppConnection() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['whatsapp-connection', currentTenant?.id];

  const { data: connection, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      return data as WhatsAppConnection | null;
    },
    enabled: !!currentTenant?.id,
  });

  const connectWhatsApp = useMutation({
    mutationFn: async (input: ConnectWhatsAppInput) => {
      if (!currentTenant?.id) {
        throw new Error('No tenant selected');
      }

      // Check if connection already exists
      const { data: existing } = await supabase
        .from('whatsapp_connections')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (existing) {
        // Update existing connection
        const { data, error } = await supabase
          .from('whatsapp_connections')
          .update({
            phone_number_id: input.phone_number_id,
            business_account_id: input.business_account_id,
            display_phone_number: input.display_phone_number,
            verified_name: input.verified_name,
            access_token_encrypted: input.access_token,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      // Create new connection
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .insert({
          tenant_id: currentTenant.id,
          phone_number_id: input.phone_number_id,
          business_account_id: input.business_account_id,
          display_phone_number: input.display_phone_number,
          verified_name: input.verified_name,
          access_token_encrypted: input.access_token,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'WhatsApp gekoppeld',
        description: 'Je WhatsApp Business account is succesvol verbonden.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Koppeling mislukt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const disconnectWhatsApp = useMutation({
    mutationFn: async () => {
      if (!connection?.id) {
        throw new Error('No connection to disconnect');
      }

      const { error } = await supabase
        .from('whatsapp_connections')
        .update({ is_active: false })
        .eq('id', connection.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'WhatsApp ontkoppeld',
        description: 'Je WhatsApp Business account is ontkoppeld.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Ontkoppelen mislukt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<Pick<WhatsAppConnection, 'is_active'>>) => {
      if (!connection?.id) {
        throw new Error('No connection to update');
      }

      const { data, error } = await supabase
        .from('whatsapp_connections')
        .update({
          ...settings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'Instellingen opgeslagen',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Opslaan mislukt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    connection,
    isLoading,
    error,
    refetch,
    connectWhatsApp,
    disconnectWhatsApp,
    updateSettings,
    isConnected: !!connection?.is_active,
  };
}
