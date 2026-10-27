import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { normalizeOverview, type PlatformBillingOverview } from '@/lib/platformBillingOverview';

export * from '@/lib/platformBillingOverview';

async function fetchOverview(tenantId?: string): Promise<PlatformBillingOverview> {
  // De RPC staat (nog) niet in de gegenereerde types; aanroepen via supabase.rpc zelf
  // (niet losgekoppeld: rpc gebruikt `this`).
  const { data, error } = await supabase.rpc(
    'platform_billing_overview' as never,
    (tenantId ? { p_tenant_id: tenantId } : {}) as never,
  );
  if (error) throw error;
  return normalizeOverview(data);
}

/** Het hele platform (dashboard, facturatiepagina). */
export function usePlatformBillingOverview() {
  const { isPlatformAdmin } = useAuth();
  return useQuery({
    queryKey: ['platform-billing-overview'],
    queryFn: () => fetchOverview(),
    enabled: isPlatformAdmin,
    staleTime: 60_000,
  });
}

/** Cijfers en alle documenten van één tenant (tenantscherm). */
export function useTenantBillingFigures(tenantId: string | undefined) {
  const { isPlatformAdmin } = useAuth();
  const q = useQuery({
    queryKey: ['platform-billing-overview', 'tenant', tenantId],
    queryFn: () => fetchOverview(tenantId),
    enabled: isPlatformAdmin && !!tenantId,
    staleTime: 60_000,
  });
  const figures = q.data?.tenants.find((t) => t.tenant_id === tenantId) ?? null;
  const documents = q.data?.documents ?? [];
  return { ...q, figures, documents };
}
