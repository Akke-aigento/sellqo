import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

export interface MetaMessagingConnection {
  id: string;
  tenant_id: string;
  platform: string;
  page_id: string;
  page_name: string | null;
  page_access_token: string;
  instagram_account_id: string | null;
  is_active: boolean | null;
  webhook_verify_token: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useMetaMessagingConnections() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['meta-messaging-connections', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('meta_messaging_connections')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MetaMessagingConnection[];
    },
    enabled: !!currentTenant?.id,
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('meta_messaging_connections')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-messaging-connections'] });
      toast.success('Messaging verbinding verwijderd');
    },
    onError: (error) => {
      toast.error('Kon verbinding niet verwijderen: ' + error.message);
    },
  });

  const getConnectionByPlatform = (platform: string) => {
    return connections.find(c => c.platform === platform && c.is_active);
  };

  const hasFacebookMessenger = () => !!getConnectionByPlatform('facebook');
  const hasInstagramDM = () => !!getConnectionByPlatform('instagram');

  const activeConnections = connections.filter(c => c.is_active);

  return {
    connections,
    activeConnections,
    isLoading,
    deleteConnection,
    getConnectionByPlatform,
    hasFacebookMessenger,
    hasInstagramDM,
  };
}
