// HORECA-NU-1 — de stand en de schrijflogica van "online bestellingen pauzeren" (PAUSE-1), los van de knop,
// zodat KitchenPauseControl (keukenscherm) en de tegel "Keuken pauzeren" op het Nu-paneel één bron delen.
// HORECA-STAAT-1: de pauze geldt voor afhalen en leveren via de webshop (ORDERING_PAUSED) én aan tafel voor
// de keukengerechten (KITCHEN_PAUSED; zonder bereidingsposten alles aan tafel). Dranken (bar) blijven
// bestelbaar. Schrijven: fulfillment_settings (RLS: tenant_admin).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export const kitchenPauseKey = (tenantId: string | undefined) => ['kitchen-pause', tenantId];
export const PAUSE_MINUTES = [15, 30, 60] as const;

/** Einde van vandaag (lokale tijd van dit toestel). */
export const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d; };

export function useKitchenPause() {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const key = kitchenPauseKey(tenantId);
  const query = useQuery({
    queryKey: key,
    enabled: !!tenantId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [fs, ts, st] = await Promise.all([
        supabase.from('fulfillment_settings').select('paused_until, qr_mode').eq('tenant_id', tenantId!).maybeSingle(),
        supabase.from('tenant_theme_settings').select('shop_live, shop_ordering').eq('tenant_id', tenantId!).maybeSingle(),
        // HORECA-STAAT-1 — met bereidingsposten liggen aan tafel enkel de keukengerechten stil.
        supabase.from('prep_stations' as never).select('id').eq('tenant_id', tenantId!).eq('is_active', true).limit(1),
      ]);
      if (fs.error) throw fs.error;
      // WANDELING: een horecazaak zonder webshop, zonder online bestellen en zonder bestellen aan tafel krijgt
      // geen dode knop; bij twijfel (fout) blijft hij staan.
      const row = fs.data as { paused_until?: string | null; qr_mode?: string | null } | null;
      return {
        until: row?.paused_until ?? null,
        webshop: !!ts.error || (!!ts.data?.shop_live && !!ts.data?.shop_ordering),
        table: row?.qr_mode === 'order',
        kitchenSplit: !st.error && ((st.data as unknown[] | null) ?? []).length > 0,
      };
    },
  });
  const set = useMutation({
    mutationFn: async (until: Date | null) => {
      // HONEST-SAVE-1: .select() zodat een door RLS geweigerde upsert niet als gelukt telt.
      const { data, error } = await supabase.from('fulfillment_settings')
        .upsert({ tenant_id: tenantId!, paused_until: until ? until.toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' })
        .select('tenant_id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('no_permission');
      return until;
    },
    onSuccess: (until) => toast.success(until ? t('admin.kitchen.paused_toast', { time: until.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) }) : t('admin.kitchen.resumed_toast')),
    onError: (e) => toast.error(e instanceof Error && e.message === 'no_permission' ? t('common.saveNoPermission') : t('admin.storefront.food.save_failed')),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
  return { ...query, set };
}
