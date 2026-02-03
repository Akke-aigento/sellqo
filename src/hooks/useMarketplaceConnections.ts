import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import type { 
  MarketplaceConnection, 
  MarketplaceType, 
  MarketplaceCredentials, 
  MarketplaceSettings 
} from '@/types/marketplace';

export function useMarketplaceConnections() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading, error } = useQuery({
    queryKey: ['marketplace-connections', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('marketplace_connections')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as MarketplaceConnection[];
    },
    enabled: !!currentTenant?.id,
  });

  const createConnection = useMutation({
    mutationFn: async (params: {
      marketplace_type: MarketplaceType;
      marketplace_name?: string;
      credentials: MarketplaceCredentials;
      settings?: Partial<MarketplaceSettings>;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const { data, error } = await supabase
        .from('marketplace_connections')
        .insert([{
          tenant_id: currentTenant.id,
          marketplace_type: params.marketplace_type,
          marketplace_name: params.marketplace_name || null,
          credentials: params.credentials as Json,
          settings: (params.settings || {}) as Json,
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as unknown as MarketplaceConnection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-connections'] });
      toast.success('Marketplace verbonden!');
    },
    onError: (error) => {
      toast.error('Kon marketplace niet verbinden: ' + error.message);
    },
  });

  const updateConnection = useMutation({
    mutationFn: async (params: {
      id: string;
      updates: Partial<Pick<MarketplaceConnection, 'marketplace_name' | 'credentials' | 'settings' | 'is_active'>>;
    }) => {
      const { data, error } = await supabase
        .from('marketplace_connections')
        .update({
          marketplace_name: params.updates.marketplace_name,
          credentials: params.updates.credentials as unknown as Json,
          settings: params.updates.settings as unknown as Json,
          is_active: params.updates.is_active,
        })
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as MarketplaceConnection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-connections'] });
      toast.success('Instellingen opgeslagen!');
    },
    onError: (error) => {
      toast.error('Kon instellingen niet opslaan: ' + error.message);
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      // First nullify marketplace_connection_id on orders to avoid FK constraint
      const { error: ordersError } = await supabase
        .from('orders')
        .update({ marketplace_connection_id: null })
        .eq('marketplace_connection_id', id);

      if (ordersError) {
        console.warn('Could not unlink orders:', ordersError);
      }

      // Then delete the connection
      const { error } = await supabase
        .from('marketplace_connections')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-connections'] });
      toast.success('Marketplace verbinding verwijderd');
    },
    onError: (error) => {
      toast.error('Kon verbinding niet verwijderen: ' + error.message);
    },
  });

  const getConnectionByType = (type: MarketplaceType) => {
    return connections.find(c => c.marketplace_type === type && c.is_active);
  };

  const activeConnections = connections.filter(c => c.is_active);
  const todayOrders = connections.reduce((sum, c) => sum + (c.stats?.totalOrders || 0), 0);
  const lastSync = connections
    .map(c => c.last_sync_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  return {
    connections,
    activeConnections,
    todayOrders,
    lastSync,
    isLoading,
    error,
    createConnection,
    updateConnection,
    deleteConnection,
    getConnectionByType,
  };
}

export function useMarketplaceConnection(connectionId: string | undefined) {
  const { data: connection, isLoading, error } = useQuery({
    queryKey: ['marketplace-connection', connectionId],
    queryFn: async () => {
      if (!connectionId) return null;
      
      const { data, error } = await supabase
        .from('marketplace_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (error) throw error;
      return data as unknown as MarketplaceConnection;
    },
    enabled: !!connectionId,
  });

  return { connection, isLoading, error };
}
