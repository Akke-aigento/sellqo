// EVENT-SYSTEEM FASE 4c — data-laag voor deur-toegangen (event_scanner_access).
//
// VEILIGHEID: het access_token wordt NOOIT client-side gezet. De insert laat de
// kolom weg zodat de DB-default encode(gen_random_bytes(32),'hex') hem server-side
// genereert (64 hex chars, UNIQUE). We lezen hem daarna één keer terug voor de QR.
//
// Intrekken = is_active op false (audit trail blijft, ticket_scans blijft gekoppeld).
// De fase-2b validatie doet een lookup op is_active = true en weigert het token dan
// direct met 401. Verwijderen is alleen zinvol bij use_count = 0.
//
// Elke write doet .select() na de mutatie (persistence-verificatie: vangt stille
// RLS-weigeringen die anders als "succes" ogen).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export type ScanDirection = 'in' | 'out' | 'both';
export type ScanMode = 'check_in' | 'validate_only' | 'check_out';

export const SCAN_DIRECTIONS: ScanDirection[] = ['in', 'out', 'both'];
export const SCAN_MODES: ScanMode[] = ['check_in', 'validate_only', 'check_out'];

export interface ScannerAccessRow {
  id: string;
  name: string;
  access_token: string;
  zone_id: string;
  direction: ScanDirection;
  scan_mode: ScanMode;
  allowed_product_ids: string[] | null;
  is_active: boolean;
  expires_at: string | null;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
}

export interface ScannerAccessFormData {
  name: string;
  /** null = geen zone gekozen → useEnsureDefaultZone maakt/gebruikt de hoofdingang */
  zone_id: string | null;
  direction: ScanDirection;
  scan_mode: ScanMode;
  /** leeg = alle tickettypes toegestaan → wordt NULL in de DB */
  allowed_product_ids: string[];
  expires_at: string | null;
}

const ROW_COLUMNS =
  'id, access_token, name, zone_id, direction, scan_mode, allowed_product_ids, is_active, expires_at, use_count, last_used_at, created_at';

/** Toegang is verlopen wanneer expires_at in het verleden ligt. */
export const isExpired = (row: Pick<ScannerAccessRow, 'expires_at'>): boolean =>
  !!row.expires_at && new Date(row.expires_at).getTime() <= Date.now();

/** De scanner-URL die in de QR gaat. Fase 5 gaat /scan/:token bedienen. */
export const scannerUrl = (token: string): string =>
  `${window.location.origin}/scan/${token}`;

export function useScannerAccesses(eventId: string | undefined) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['event-scanner-accesses', currentTenant?.id, eventId],
    queryFn: async (): Promise<ScannerAccessRow[]> => {
      if (!currentTenant || !eventId) return [];
      const { data, error } = await supabase
        .from('event_scanner_access')
        .select(ROW_COLUMNS)
        .eq('tenant_id', currentTenant.id)
        .eq('event_detail_id', eventId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ScannerAccessRow[];
    },
    enabled: !!currentTenant && !!eventId,
  });
}

/** Zones van dit event, voor de zone-dropdown. */
export function useEventZones(eventId: string | undefined) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['event-scanner-zones', currentTenant?.id, eventId],
    queryFn: async (): Promise<{ id: string; name: string; is_default: boolean }[]> => {
      if (!currentTenant || !eventId) return [];
      const { data, error } = await supabase
        .from('event_zones')
        .select('id, name, is_default, sort_order')
        .eq('tenant_id', currentTenant.id)
        .eq('event_detail_id', eventId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((z) => ({
        id: z.id as string,
        name: (z.name as string) ?? '—',
        is_default: Boolean(z.is_default),
      }));
    },
    enabled: !!currentTenant && !!eventId,
  });
}

function useInvalidate(eventId: string | undefined) {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  return () => {
    queryClient.invalidateQueries({
      queryKey: ['event-scanner-accesses', currentTenant?.id, eventId],
    });
    queryClient.invalidateQueries({
      queryKey: ['event-scanner-zones', currentTenant?.id, eventId],
    });
    queryClient.invalidateQueries({
      queryKey: ['event-detail-zones', currentTenant?.id, eventId],
    });
    queryClient.invalidateQueries({
      queryKey: ['event-detail-scanners', currentTenant?.id, eventId],
    });
  };
}

/**
 * zone_id is NOT NULL op event_scanner_access. Heeft dit event nog geen zone,
 * dan maken we er stilzwijgend één aan ('Hoofdingang', is_default) en geven die
 * terug. Bestaat er al een zone, dan wordt er niets aangemaakt.
 */
export function useEnsureDefaultZone(eventId: string | undefined) {
  const { currentTenant } = useTenant();
  const invalidate = useInvalidate(eventId);

  return useMutation({
    mutationFn: async (defaultName: string): Promise<string> => {
      if (!eventId || !currentTenant) throw new Error('Geen event of tenant');

      const { data: existing, error: readErr } = await supabase
        .from('event_zones')
        .select('id, is_default')
        .eq('tenant_id', currentTenant.id)
        .eq('event_detail_id', eventId)
        .order('sort_order', { ascending: true });
      if (readErr) throw readErr;
      if (existing && existing.length > 0) {
        const preferred = existing.find((z) => Boolean(z.is_default)) ?? existing[0];
        return preferred.id as string;
      }

      const { data, error } = await supabase
        .from('event_zones')
        .insert({
          tenant_id: currentTenant.id,
          // XOR-check: uitsluitend event_detail_id, nooit event_group_id.
          event_detail_id: eventId,
          name: defaultName,
          is_default: true,
          sort_order: 0,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => invalidate(),
  });
}

export function useCreateScannerAccess(eventId: string | undefined) {
  const { currentTenant } = useTenant();
  const invalidate = useInvalidate(eventId);

  return useMutation({
    mutationFn: async (
      form: ScannerAccessFormData & { zone_id: string },
    ): Promise<ScannerAccessRow> => {
      if (!eventId || !currentTenant) throw new Error('Geen event of tenant');
      const { data: auth } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('event_scanner_access')
        .insert({
          tenant_id: currentTenant.id,
          event_detail_id: eventId,
          zone_id: form.zone_id,
          name: form.name.trim(),
          direction: form.direction,
          scan_mode: form.scan_mode,
          allowed_product_ids:
            form.allowed_product_ids.length > 0 ? form.allowed_product_ids : null,
          expires_at: form.expires_at,
          created_by: auth?.user?.id ?? null,
          // access_token BEWUST weggelaten → DB-default genereert hem server-side.
        })
        .select(ROW_COLUMNS)
        .single();
      if (error) throw error;
      return data as unknown as ScannerAccessRow;
    },
    onSuccess: () => invalidate(),
  });
}

/** Intrekken: is_active = false. Werkt direct tegen de fase-2b validatie. */
export function useRevokeScannerAccess(eventId: string | undefined) {
  const { currentTenant } = useTenant();
  const invalidate = useInvalidate(eventId);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!currentTenant) throw new Error('Geen tenant');
      const { data, error } = await supabase
        .from('event_scanner_access')
        .update({ is_active: false })
        .eq('id', id)
        .eq('tenant_id', currentTenant.id)
        .select('id, is_active')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(),
  });
}

/** Verwijderen: alleen toegestaan zolang de toegang nooit gebruikt is. */
export function useDeleteScannerAccess(eventId: string | undefined) {
  const { currentTenant } = useTenant();
  const invalidate = useInvalidate(eventId);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!currentTenant) throw new Error('Geen tenant');
      const { data, error } = await supabase
        .from('event_scanner_access')
        .delete()
        .eq('id', id)
        .eq('tenant_id', currentTenant.id)
        .eq('use_count', 0)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Verwijderen niet toegestaan');
      return id;
    },
    onSuccess: () => invalidate(),
  });
}
