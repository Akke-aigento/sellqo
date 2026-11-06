// MENUKAART-PRINT-1 — gekozen sjabloon, opties en kaftfoto per zaak (tabel menu_print_settings),
// zodat een zaak het niet telkens opnieuw kiest, ook niet op een ander toestel. Elke keuze wordt
// ook lokaal bewaard: bestaat de tabel nog niet (beheer live vóór de migratie) of mag deze rol niet
// schrijven, dan onthoudt dit toestel het toch.
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '@/hooks/useTenant';
import { untypedTable } from '@/lib/untypedTable';
import { parseMenuPrintSettings, type MenuPrintSettings } from '@/lib/menuPrint';

const localKey = (tenantId: string) => `sq_menu_print_${tenantId}`;
export const menuPrintKey = (tenantId: string | undefined) => ['menu-print-settings', tenantId];

interface Row { tenant_id: string; template: string; options: unknown; cover_image_url: string | null }

function readLocal(tenantId: string): MenuPrintSettings | null {
  try {
    const raw = localStorage.getItem(localKey(tenantId));
    return raw ? parseMenuPrintSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function useMenuPrintSettings() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: menuPrintKey(tenantId),
    enabled: !!tenantId,
    queryFn: async (): Promise<MenuPrintSettings> => {
      const { data, error } = await untypedTable<Row>('menu_print_settings')
        .select('tenant_id, template, options, cover_image_url').eq('tenant_id', tenantId!).maybeSingle();
      if (!error && data) return parseMenuPrintSettings(data);
      return readLocal(tenantId!) ?? parseMenuPrintSettings(null);
    },
  });

  /** Bewaren: meteen lokaal en in de cache, daarna in de database. Geeft false als de database weigerde. */
  const save = useCallback(async (next: MenuPrintSettings, canWrite: boolean): Promise<boolean> => {
    if (!tenantId) return false;
    qc.setQueryData(menuPrintKey(tenantId), next);
    try { localStorage.setItem(localKey(tenantId), JSON.stringify(next)); } catch { /* privémodus */ }
    if (!canWrite) return false;
    const { error } = await untypedTable('menu_print_settings').upsert({
      tenant_id: tenantId, template: next.template, options: next.options, cover_image_url: next.coverImageUrl, updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });
    return !error;
  }, [qc, tenantId]);

  return { settings: query.data, isLoading: query.isLoading, save };
}
