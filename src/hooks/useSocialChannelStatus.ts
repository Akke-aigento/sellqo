// MARKETING-1 — status van de social-koppelingen zonder tokens (RPC social_connection_status).
// Werkt ook voor de rollen staff en marketing; social_connections zelf is enkel voor tenant_admin.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export interface SocialChannelStatus {
  id: string;
  platform: string;
  api_kind: string | null;
  account_name: string | null;
  account_avatar: string | null;
  is_active: boolean;
  token_expires_at: string | null;
  updated_at: string | null;
}

export const SOCIAL_CHANNEL_STATUS_KEY = 'social-channel-status';

export function isExpired(c: Pick<SocialChannelStatus, 'token_expires_at'>): boolean {
  return !!c.token_expires_at && new Date(c.token_expires_at) < new Date();
}

export function useSocialChannelStatus() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const query = useQuery({
    queryKey: [SOCIAL_CHANNEL_STATUS_KEY, tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      // social_connection_status staat nog niet in de gegenereerde types (MARKETING-1).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('social_connection_status', { p_tenant: tenantId });
      if (error) throw error;
      return (data ?? []) as SocialChannelStatus[];
    },
  });
  const channels = query.data ?? [];
  return {
    channels,
    isLoading: query.isLoading,
    /** Een actieve, niet-verlopen koppeling met Instagram of Facebook: SellQo kan posten. */
    canPublish: channels.some((c) => c.is_active && !isExpired(c) && (c.platform === 'instagram' || c.platform === 'facebook')),
    refetch: query.refetch,
  };
}
