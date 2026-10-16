// PHOTO-STD-1 (16-10-2026) — fotostandaard van de huidige winkel (tenant_media_settings).
// Geen rij = de standaard staat uit; we geven dan DEFAULT_PHOTO_STANDARD terug.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { untypedTable } from '@/lib/untypedTable';
import { useTenant } from './useTenant';
import { DEFAULT_PHOTO_STANDARD, type PhotoStandardSettings } from '@/lib/photoStandard';

// De tabel is nieuw en staat nog niet in de gegenereerde types.
const settingsTable = () => untypedTable<PhotoStandardSettings>('tenant_media_settings');

const FIELDS = 'enabled, aspect_w, aspect_h, target_width, background, margin_pct, auto_trim, apply_on_upload';

export function useMediaSettings() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const query = useQuery({
    queryKey: ['tenant-media-settings', tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PhotoStandardSettings> => {
      const { data, error } = await settingsTable().select(FIELDS).eq('tenant_id', tenantId).maybeSingle();
      // Bestaat de tabel nog niet (vóór de migratie live staat), dan gewoon "uit".
      if (error || !data) return DEFAULT_PHOTO_STANDARD;
      return { ...DEFAULT_PHOTO_STANDARD, ...data, margin_pct: Number(data.margin_pct) };
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<PhotoStandardSettings>) => {
      if (!tenantId) throw new Error('Geen winkel geselecteerd');
      const next = { ...(query.data ?? DEFAULT_PHOTO_STANDARD), ...patch };
      const { error } = await settingsTable().upsert({ tenant_id: tenantId, ...next }, { onConflict: 'tenant_id' });
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['tenant-media-settings', tenantId], next);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { settings: query.data ?? DEFAULT_PHOTO_STANDARD, isLoading: query.isLoading, save };
}
