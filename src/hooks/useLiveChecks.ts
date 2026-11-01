// HORECA-ZIJBALK-1 — open rekeningen voor het live zaaloverzicht in het beheer (/admin/zaal).
//
// Zelfde bron als SellQo Kassa (horeca_snapshot), maar trager en zonder wachtrij: elke 10 s één
// getal (horeca_state.version); enkel als dat veranderde de open rekeningen ophalen. Alleen-lezen:
// dit roept nooit horeca_apply aan. Niet peilen in een verborgen tabblad (react-query standaard).
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import type { Check, Snapshot } from '@/kassa/app/horeca/types';

export const LIVE_POLL_MS = 10_000;

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
// bind: zonder supabase als `this` faalt elke aanroep live ("reading 'rest'").
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;

export function useLiveChecks(): { checks: Check[]; isLoading: boolean; error: unknown; polledAt: number } {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const version = useQuery({
    queryKey: ['horeca-live-version', tenantId],
    enabled: !!tenantId,
    refetchInterval: LIVE_POLL_MS,
    queryFn: async () => {
      const { data, error } = await supabase.from('horeca_state' as never).select('version').eq('tenant_id' as never, tenantId as never).maybeSingle();
      if (error) throw error;
      return Number((data as { version?: number } | null)?.version ?? 0);
    },
  });

  const snapshot = useQuery({
    queryKey: ['horeca-live-snapshot', tenantId, version.data],
    enabled: !!tenantId && version.data !== undefined,
    // Per versie één keer ophalen; een nieuwe versie = een nieuwe sleutel.
    staleTime: Infinity,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await rpc('horeca_snapshot', { p_tenant_id: tenantId });
      if (error) throw error;
      return data as Snapshot;
    },
  });

  return {
    checks: snapshot.data?.checks ?? [],
    isLoading: version.isLoading || (snapshot.isLoading && !snapshot.data),
    error: version.error ?? snapshot.error,
    polledAt: version.dataUpdatedAt,
  };
}
