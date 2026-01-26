import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import type { 
  SocialChannelConnection, 
  SocialChannelType, 
  SocialChannelCredentials 
} from '@/types/socialChannels';

export function useSocialChannels() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading, error } = useQuery({
    queryKey: ['social-channels', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('social_channel_connections')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as SocialChannelConnection[];
    },
    enabled: !!currentTenant?.id,
  });

  const createConnection = useMutation({
    mutationFn: async (params: {
      channel_type: SocialChannelType;
      channel_name?: string;
      credentials?: SocialChannelCredentials;
      feed_format?: 'xml' | 'json' | 'csv';
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      // Generate feed URL for feed-based channels
      const feedUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-product-feed?tenant_id=${currentTenant.id}&format=${params.channel_type}`;

      const { data, error } = await supabase
        .from('social_channel_connections')
        .insert([{
          tenant_id: currentTenant.id,
          channel_type: params.channel_type,
          channel_name: params.channel_name || null,
          credentials: (params.credentials || {}) as Json,
          feed_url: feedUrl,
          feed_format: params.feed_format || 'xml',
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SocialChannelConnection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-channels'] });
      toast.success('Kanaal verbonden!');
    },
    onError: (error) => {
      toast.error('Kon kanaal niet verbinden: ' + error.message);
    },
  });

  const updateConnection = useMutation({
    mutationFn: async (params: {
      id: string;
      updates: Partial<Pick<SocialChannelConnection, 'channel_name' | 'credentials' | 'is_active' | 'feed_format'>>;
    }) => {
      const { data, error } = await supabase
        .from('social_channel_connections')
        .update({
          channel_name: params.updates.channel_name,
          credentials: params.updates.credentials as any,
          is_active: params.updates.is_active,
          feed_format: params.updates.feed_format,
        })
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as SocialChannelConnection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-channels'] });
      toast.success('Instellingen opgeslagen!');
    },
    onError: (error) => {
      toast.error('Kon instellingen niet opslaan: ' + error.message);
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('social_channel_connections')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-channels'] });
      toast.success('Kanaal verbinding verwijderd');
    },
    onError: (error) => {
      toast.error('Kon verbinding niet verwijderen: ' + error.message);
    },
  });

  const getConnectionByType = (type: SocialChannelType) => {
    return connections.find(c => c.channel_type === type && c.is_active);
  };

  const activeConnections = connections.filter(c => c.is_active);
  const totalProductsSynced = connections.reduce((sum, c) => sum + (c.products_synced || 0), 0);

  return {
    connections,
    activeConnections,
    totalProductsSynced,
    isLoading,
    error,
    createConnection,
    updateConnection,
    deleteConnection,
    getConnectionByType,
  };
}

// Hook to update product social channels
export function useProductSocialChannels() {
  const queryClient = useQueryClient();

  const updateProductChannels = useMutation({
    mutationFn: async ({ productId, channels }: { productId: string; channels: Record<string, boolean> }) => {
      const { data, error } = await supabase
        .from('products')
        .update({ social_channels: channels })
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Kanaal selectie opgeslagen');
    },
    onError: (error) => {
      toast.error('Kon kanalen niet opslaan: ' + error.message);
    },
  });

  const bulkUpdateProductChannels = useMutation({
    mutationFn: async ({ productIds, channels }: { productIds: string[]; channels: Record<string, boolean> }) => {
      const { error } = await supabase
        .from('products')
        .update({ social_channels: channels })
        .in('id', productIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Kanalen bijgewerkt voor geselecteerde producten');
    },
    onError: (error) => {
      toast.error('Kon kanalen niet bijwerken: ' + error.message);
    },
  });

  return {
    updateProductChannels,
    bulkUpdateProductChannels,
  };
}
