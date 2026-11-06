// TAFEL-SAMEN-1 — tafelgroepen (QR aan tafel) en hun waarschuwingen voor Zaal › Live en het Nu-paneel.
// Zelfde ritme als useLiveChecks: volgt horeca_state.version (zelfde querysleutel, dus geen extra peiling) en
// haalt horeca_table_groups enkel opnieuw bij een nieuwe versie, of na een minuut (een groep die door
// inactiviteit afloopt, verandert de versie niet). "Tafel vrijgeven" via table_group_release.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { LIVE_POLL_MS } from '@/hooks/useLiveChecks';
import type { TableGroupsData } from '@/lib/horeca/tableGroups';

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
// R14: nooit losgekoppeld (zonder `this` faalt elke aanroep live).
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
/** Functie bestaat (nog) niet: migratie niet gedraaid → geen waarschuwingen, nooit een fout op het scherm. */
const isMissingFn = (e: { code?: string } | null) => e?.code === 'PGRST202' || e?.code === '42883';

export const tableGroupsKey = (tenantId: string | undefined) => ['horeca-table-groups', tenantId];

export function useTableGroups(enabled = true) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const version = useQuery({
    queryKey: ['horeca-live-version', tenantId],
    enabled: enabled && !!tenantId,
    refetchInterval: LIVE_POLL_MS,
    queryFn: async () => {
      const { data, error } = await supabase.from('horeca_state' as never).select('version').eq('tenant_id' as never, tenantId as never).maybeSingle();
      if (error) throw error;
      return Number((data as { version?: number } | null)?.version ?? 0);
    },
  });
  return useQuery({
    queryKey: [...tableGroupsKey(tenantId), version.data],
    enabled: enabled && !!tenantId && version.data !== undefined,
    staleTime: 60_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<TableGroupsData | null> => {
      const { data, error } = await rpc('horeca_table_groups', { p_tenant_id: tenantId });
      if (isMissingFn(error)) return null;
      if (error) throw error;
      return data as TableGroupsData;
    },
  });
}

export function useReleaseTable() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tableId: string) => {
      const { data, error } = await rpc('table_group_release', { p_tenant_id: tenantId, p_table_id: tableId });
      if (error) throw error;
      return (data as { released?: number } | null)?.released ?? 0;
    },
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: tableGroupsKey(tenantId) }),
      qc.invalidateQueries({ queryKey: ['horeca-live-version', tenantId] }),
    ]),
  });
}
