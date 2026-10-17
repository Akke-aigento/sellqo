// MODULES-1 → TRACKS-1 — sporen per winkel (webshop, horeca, events).
// Een spoor staat aan als:
//  - het plan bij dat spoor hoort (pricing_plans.track),
//  - de winkel het als add-on heeft (tenants.business_modules — alleen SellQo kan dat wijzigen,
//    afgedwongen door de trigger tenants_protect_platform_columns),
//  - of een platformadmin het ontgrendeld heeft (tenant_feature_overrides.granted_features).
// Platformadmins in beheerweergave zien alles. Zie src/lib/tracks.ts.
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformViewMode } from '@/hooks/usePlatformViewMode';
import { useTenant } from '@/hooks/useTenant';
import { useTenantPageOverrides } from '@/hooks/useTenantPageOverrides';
import { useTenantSubscription } from '@/hooks/useTenantSubscription';
import { TRACKS, tenantTracks, type Track } from '@/lib/tracks';

/** Sporen die als add-on of module bij een winkel kunnen komen. */
export const BUSINESS_MODULES = TRACKS;
export type BusinessModule = Track;

export const isBusinessModule = (key: string | undefined): key is BusinessModule =>
  !!key && (BUSINESS_MODULES as readonly string[]).includes(key);

/** De add-ons van de winkel (tenants.business_modules), zonder plan of admin-ontgrendeling. */
export function tenantModules(tenant: unknown): BusinessModule[] {
  const raw = (tenant as { business_modules?: string[] | null } | null)?.business_modules;
  return (raw || []).filter(isBusinessModule);
}

/**
 * TRACKS-1 — de sporen van de huidige winkel. `ready` is false zolang het
 * abonnement laadt; bewaak pagina's pas daarna (anders flitst "niet in je pakket").
 */
export function useTracks() {
  const { isPlatformAdmin } = useAuth();
  const { isAdminView } = usePlatformViewMode();
  const { isFeatureGranted } = useTenantPageOverrides();
  const { subscription, isLoading } = useTenantSubscription();
  const { currentTenant } = useTenant();

  const bypass = isPlatformAdmin && isAdminView;
  const tracks = tenantTracks({
    planTrack: (subscription?.pricing_plan as { track?: unknown } | undefined)?.track,
    addons: tenantModules(currentTenant),
    granted: TRACKS.filter((t) => isFeatureGranted(t)),
  });
  const planTrack = tenantTracks({ planTrack: (subscription?.pricing_plan as { track?: unknown } | undefined)?.track })[0];

  const hasTrack = useCallback((t: Track): boolean => bypass || tracks.includes(t), [bypass, tracks]);

  return { tracks, planTrack, hasTrack, ready: !isLoading || !currentTenant, bypass };
}

/** Antwoord uit een niet-2xx-antwoord van een edge function (FunctionsHttpError). */
async function readErrorBody(error: unknown): Promise<{ code?: string; available_from?: string } | undefined> {
  try {
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === 'function') return (await ctx.clone().json()) as { code?: string; available_from?: string };
  } catch { /* geen json */ }
  return undefined;
}

export function useBusinessModules() {
  const { t } = useTranslation();
  const { isPlatformAdmin } = useAuth();
  const { currentTenant, refreshTenants } = useTenant();
  const { hasTrack, planTrack, tracks } = useTracks();
  const [saving, setSaving] = useState(false);
  const chosen = tenantModules(currentTenant);

  const has = useCallback((m: BusinessModule): boolean => hasTrack(m), [hasTrack]);

  /**
   * Zet een add-on aan of uit. TRACKS-1: alleen platformadmins. BILL-ADDON-1: via
   * sync-tenant-plan, zodat de add-on ook op de factuur komt (aan = pro rata meteen,
   * uit = einde van de betaalde periode). Winkels die SellQo niet factureert: alleen de module.
   */
  const setModule = useCallback(async (m: BusinessModule, on: boolean) => {
    if (!currentTenant?.id || !isPlatformAdmin) return false;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('sync-tenant-plan', {
      body: { tenant_id: currentTenant.id, action: 'addon', addon_id: `addon_${m}`, enabled: on },
    });
    setSaving(false);
    const res = (data ?? {}) as {
      success?: boolean; code?: string; effective_at?: string; pro_rata_total?: number;
      awaiting_payment?: boolean; pending?: boolean; available_from?: string;
    };
    if (error || !res.success) {
      const body = res.code ? res : await readErrorBody(error);
      const code = body?.code;
      if (code === 'addon_needs_plan') toast.error(t('admin.modules.needs_plan'));
      else if (code === 'renewal_pending' && body?.available_from) {
        toast.error(t('admin.modules.renewal_pending', { date: new Date(body.available_from).toLocaleDateString() }));
      } else if (code === 'proration_cycle_open') toast.error(t('admin.modules.payment_open'));
      else toast.error(t('admin.modules.save_failed'));
      return false;
    }
    // Manueel betalen: de add-on gaat pas aan zodra het betaalverzoek betaald is.
    if (on && res.pending) {
      toast.info(t('admin.modules.pro_rata_requested', {
        amount: (res.pro_rata_total ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'EUR' }),
      }));
      return false;
    }
    if (!on && res.effective_at && new Date(res.effective_at).getTime() > Date.now() + 60_000) {
      toast.info(t('admin.modules.off_at_period_end', { date: new Date(res.effective_at).toLocaleDateString() }));
    }
    if (on && (res.pro_rata_total ?? 0) > 0) {
      toast.info(t('admin.modules.pro_rata_charged', {
        amount: (res.pro_rata_total ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'EUR' }),
      }));
    }
    await refreshTenants();
    return true;
  }, [currentTenant?.id, refreshTenants, t, isPlatformAdmin]);

  return { has, chosen, setModule, saving, planTrack, tracks, canManage: isPlatformAdmin };
}
