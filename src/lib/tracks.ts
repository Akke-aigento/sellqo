// TRACKS-1 — de drie sporen van SellQo.
//
// Elk plan hoort bij één spoor (pricing_plans.track). Een winkel kan er add-ons
// bij hebben (tenants.business_modules, alleen door SellQo te wijzigen) of door
// een platformadmin ontgrendelde modules (tenant_feature_overrides.granted_features).
// Het spoor bepaalt welke menu-items en pagina's de winkel ziet; binnen een spoor
// blijven de plan-features gelden. Bron van de matrix: `tracks` op de NavItems in
// src/components/admin/sidebar/sidebarConfig.ts — menu én pagina-bewaking lezen daaruit.

export const TRACKS = ['webshop', 'horeca', 'events'] as const;
export type Track = (typeof TRACKS)[number];

export const isTrack = (value: unknown): value is Track =>
  typeof value === 'string' && (TRACKS as readonly string[]).includes(value);

export interface TrackSources {
  /** pricing_plans.track van het huidige plan; ontbreekt → webshop. */
  planTrack?: unknown;
  /** tenants.business_modules — betaalde add-ons. */
  addons?: readonly unknown[] | null;
  /** tenant_feature_overrides.granted_features — door een platformadmin ontgrendeld. */
  granted?: readonly unknown[] | null;
}

/** Alle sporen van een winkel: plan + add-ons + ontgrendelde modules. */
export function tenantTracks({ planTrack, addons, granted }: TrackSources): Track[] {
  const out = new Set<Track>([isTrack(planTrack) ? planTrack : 'webshop']);
  for (const a of addons ?? []) if (isTrack(a)) out.add(a);
  for (const g of granted ?? []) if (isTrack(g)) out.add(g);
  return TRACKS.filter((t) => out.has(t));
}

/** Mag een item met deze sporen getoond worden? Geen sporen = kern, altijd. */
export function tracksAllow(itemTracks: readonly Track[] | undefined, has: (t: Track) => boolean): boolean {
  return !itemTracks || itemTracks.length === 0 || itemTracks.some(has);
}
