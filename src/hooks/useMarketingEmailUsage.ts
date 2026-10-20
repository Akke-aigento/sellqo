// MAIL-LIMIT-UI — limiet en verbruik van marketingmails deze maand voor de eigen winkel.
// Bron: de RPC marketing_email_usage, die dezelfde marketing_email_limit en
// marketing_emails_used aanroept als de verzendwachtrij. monthly = null betekent onbeperkt.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export interface MarketingEmailUsage {
  monthly: number | null;
  used: number;
}

export async function fetchMarketingEmailUsage(tenantId: string): Promise<MarketingEmailUsage> {
  const { data, error } = await supabase.rpc('marketing_email_usage', { p_tenant: tenantId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return {
    monthly: typeof row?.monthly === 'number' ? row.monthly : null,
    used: typeof row?.used === 'number' ? row.used : 0,
  };
}

export function useMarketingEmailUsage() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['marketing-email-usage', currentTenant?.id],
    queryFn: () => fetchMarketingEmailUsage(currentTenant!.id),
    enabled: !!currentTenant?.id,
    staleTime: 60_000,
    retry: false,
  });
}
