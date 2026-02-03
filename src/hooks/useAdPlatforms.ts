import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import type { AdPlatformConnection, AdPlatform } from '@/types/ads';
import type { Json } from '@/integrations/supabase/types';
import type { MarketplaceCredentials } from '@/types/marketplace';
import { toast } from '@/hooks/use-toast';

export type PlatformStatus = 'ready' | 'requires_connection' | 'requires_advertising_credentials' | 'coming_soon';

export function useAdPlatforms() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['ad-platform-connections', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('ad_platform_connections')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('platform');
      
      if (error) throw error;
      return data as AdPlatformConnection[];
    },
    enabled: !!currentTenant?.id,
  });

  // Query marketplace connections to check for Bol.com retailer connection
  const { data: marketplaceConnections = [] } = useQuery({
    queryKey: ['marketplace-connections-for-ads', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('marketplace_connections')
        .select('id, marketplace_type, is_active, credentials')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  // Check if Bol.com retailer connection exists
  const hasBolRetailerConnection = () => {
    return marketplaceConnections.some(c => 
      c.marketplace_type === 'bol_com' && c.is_active
    );
  };

  // Get the Bol.com retailer connection
  const getBolRetailerConnection = () => {
    return marketplaceConnections.find(c => 
      c.marketplace_type === 'bol_com' && c.is_active
    );
  };

  // Check if Bol.com has advertising credentials
  const hasBolAdvertisingCredentials = () => {
    const bolConnection = marketplaceConnections.find(c => 
      c.marketplace_type === 'bol_com' && c.is_active
    );
    if (!bolConnection) return false;
    const creds = bolConnection.credentials as MarketplaceCredentials;
    return !!(creds?.advertisingClientId && creds?.advertisingClientSecret);
  };

  // Get platform availability status
  const getPlatformStatus = (platform: AdPlatform): PlatformStatus => {
    if (platform === 'bol_ads') {
      if (!hasBolRetailerConnection()) return 'requires_connection';
      if (!hasBolAdvertisingCredentials()) return 'requires_advertising_credentials';
      return 'ready';
    }
    // Meta, Google, Amazon are coming soon
    return 'coming_soon';
  };

  const connectPlatform = useMutation({
    mutationFn: async (input: {
      platform: AdPlatform;
      account_id?: string;
      account_name?: string;
      access_token?: string;
      refresh_token?: string;
      token_expires_at?: string;
      config?: object;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');
      
      const { data, error } = await supabase
        .from('ad_platform_connections')
        .upsert([{
          tenant_id: currentTenant.id,
          platform: input.platform,
          account_id: input.account_id,
          account_name: input.account_name,
          access_token: input.access_token,
          refresh_token: input.refresh_token,
          token_expires_at: input.token_expires_at,
          config: input.config as Json,
          is_active: true,
        }], {
          onConflict: 'tenant_id,platform'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ad-platform-connections'] });
      toast({ title: `${variables.platform} gekoppeld` });
    },
    onError: (error) => {
      toast({ title: 'Fout bij koppelen', description: error.message, variant: 'destructive' });
    }
  });

  const disconnectPlatform = useMutation({
    mutationFn: async (platform: AdPlatform) => {
      if (!currentTenant?.id) throw new Error('No tenant');
      
      const { error } = await supabase
        .from('ad_platform_connections')
        .update({ is_active: false, access_token: null, refresh_token: null })
        .eq('tenant_id', currentTenant.id)
        .eq('platform', platform);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-platform-connections'] });
      toast({ title: 'Platform ontkoppeld' });
    }
  });

  const getConnection = (platform: AdPlatform) => {
    return connections.find(c => c.platform === platform && c.is_active);
  };

  const isConnected = (platform: AdPlatform) => {
    return !!getConnection(platform);
  };

  const connectedPlatforms = connections.filter(c => c.is_active);

  return {
    connections,
    connectedPlatforms,
    isLoading,
    connectPlatform,
    disconnectPlatform,
    getConnection,
    isConnected,
    // New validation helpers
    marketplaceConnections,
    hasBolRetailerConnection,
    getBolRetailerConnection,
    hasBolAdvertisingCredentials,
    getPlatformStatus,
  };
}
