/**
 * MAIL-UX-1 — tabbladen van Marketing → E-mail (/admin/marketing?tab=…).
 *
 * De whitelist houdt bestaande links werkend (?tab=subscribers vanuit Instellingen →
 * E-mailinschrijving, ?tab=automations&trigger=… vanuit de AI-coach en de doorverwijzing van
 * /admin/marketing/automations). Een onbekende waarde valt terug op de standaard.
 */
export const MARKETING_TABS = ['overview', 'campaigns', 'automations', 'templates', 'segments', 'subscribers'] as const;

export type MarketingTab = (typeof MARKETING_TABS)[number];

export function parseMarketingTab(value: string | null | undefined): MarketingTab | null {
  return MARKETING_TABS.find((tab) => tab === value) ?? null;
}

/**
 * Zonder ?tab=: een winkel met campagnes landt op het Overzicht (cijfers, grafiek, live activiteit);
 * een winkel zonder campagnes op Campagnes, waar de lege staat meteen "maak je eerste campagne"
 * aanbiedt. Een overzicht vol nullen zegt een nieuwe winkel niets.
 */
export function defaultMarketingTab(campaignCount: number): MarketingTab {
  return campaignCount > 0 ? 'overview' : 'campaigns';
}

/** Query na een tabwissel: ?tab= gezet, andere parameters blijven; ?trigger= hoort enkel bij Automatiseringen. */
export function marketingTabSearch(current: URLSearchParams, tab: MarketingTab): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set('tab', tab);
  if (tab !== 'automations') next.delete('trigger');
  return next;
}

/** Doel van de oude route /admin/marketing/automations, met behoud van de query (bv. ?trigger=). */
export function marketingAutomationsTarget(search: string): string {
  const params = new URLSearchParams(search);
  params.set('tab', 'automations');
  return `/admin/marketing?${params.toString()}`;
}
