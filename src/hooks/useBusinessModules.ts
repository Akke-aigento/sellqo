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

export function useBusinessModules() {
  const { t } = useTranslation();
  const { isPlatformAdmin } = useAuth();
  const { currentTenant, refreshTenants } = useTenant();
  const { hasTrack, planTrack, tracks } = useTracks();
  const [saving, setSaving] = useState(false);
  const chosen = tenantModules(currentTenant);

  const has = useCallback((m: BusinessModule): boolean => hasTrack(m), [hasTrack]);

  /**
   * Zet een add-on aan of uit. TRACKS-1: alleen platformadmins — add-ons zijn
   * betalend en de database weigert het voor iedereen anders.
   */
  const setModule = useCallback(async (m: BusinessModule, on: boolean) => {
    if (!currentTenant?.id || !isPlatformAdmin) return false;
    const next = on ? [...new Set([...chosen, m])] : chosen.filter((x) => x !== m);
    setSaving(true);
    const { error } = await supabase.from('tenants').update({ business_modules: next }).eq('id', currentTenant.id);
    setSaving(false);
    if (error) { toast.error(t('admin.modules.save_failed')); return false; }
    await refreshTenants();
    return true;
  }, [currentTenant?.id, chosen, refreshTenants, t, isPlatformAdmin]);

  return { has, chosen, setModule, saving, planTrack, tracks, canManage: isPlatformAdmin };
}
