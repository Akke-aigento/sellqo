// MODULES-1 → TRACKS-1 — sporen per winkel (webshop, horeca, events).
// Een spoor staat aan als:
//  - het plan bij dat spoor hoort (pricing_plans.track),
//  - de winkel het als add-on heeft (tenants.business_modules — alleen SellQo kan dat wijzigen,
//    afgedwongen door de trigger tenants_protect_platform_columns),
//  - of een platformadmin het ontgrendeld heeft (tenant_feature_overrides.granted_features).
// Platformadmins in beheerweergave zien alles. Zie src/lib/tracks.ts.
import { useCallback, useEffect, useMemo } from 'react';
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
const TRACKS_CACHE_KEY = 'sq_last_tracks';

export function useTracks() {
  const { isPlatformAdmin } = useAuth();
  const { isAdminView } = usePlatformViewMode();
  const { isFeatureGranted } = useTenantPageOverrides();
  const { subscription, isLoading } = useTenantSubscription();
  const { currentTenant, loading: tenantLoading } = useTenant();

  const bypass = isPlatformAdmin && isAdminView;
  const tracks = tenantTracks({
    planTrack: (subscription?.pricing_plan as { track?: unknown } | undefined)?.track,
    addons: tenantModules(currentTenant),
    granted: TRACKS.filter((t) => isFeatureGranted(t)),
  });
  const planTrack = tenantTracks({ planTrack: (subscription?.pricing_plan as { track?: unknown } | undefined)?.track })[0];

  // WANDELING (29-10): ook wachten op de winkel zelf. Met enkel `!currentTenant` was ready true zolang de
  // winkel nog laadde, en flitste "Niet in je pakket" (en het webshopmenu) bij elke paginalading.
  // Met een winkel: wachten op het abonnement (zoals voorheen; een refreshTenants verandert daar niets aan,
  // zodat een pagina niet wegspringt). Zonder winkel: pas klaar als de winkels geladen zijn.
  const ready = currentTenant ? !isLoading : !tenantLoading;

  // Tijdens het laden: de sporen van de vorige keer op dit toestel, zodat het menu meteen klopt (een
  // horecazaak ziet geen webshopmenu, een webshop geen springend menu). Pagina's wachten wel op `ready`.
  const cached = useMemo<Track[] | null>(() => {
    try {
      const raw = localStorage.getItem(TRACKS_CACHE_KEY);
      const list = raw ? (JSON.parse(raw) as unknown) : null;
      return Array.isArray(list) ? TRACKS.filter((t) => list.includes(t)) : null;
    } catch { return null; }
  }, []);
  const tracksKey = tracks.join(',');
  useEffect(() => {
    if (!ready || !currentTenant) return;
    try { localStorage.setItem(TRACKS_CACHE_KEY, JSON.stringify(tracksKey.split(','))); } catch { /* opslag vol of uit */ }
  }, [ready, currentTenant, tracksKey]);
  const effective = ready || !cached?.length ? tracks : cached;

  const hasTrack = useCallback((t: Track): boolean => bypass || effective.includes(t), [bypass, effective]);
  return { tracks, planTrack, hasTrack, ready, bypass };
}

export function useBusinessModules() {
  const { currentTenant } = useTenant();
  const { hasTrack, planTrack, tracks, ready } = useTracks();
  const chosen = tenantModules(currentTenant);
  const has = useCallback((m: BusinessModule): boolean => hasTrack(m), [hasTrack]);
  // ADDON-SELF-1: aan/uit zetten gaat via useTenantPackage (prijs vooraf, pay-first).
  return { has, ready, chosen, planTrack, tracks };
}
