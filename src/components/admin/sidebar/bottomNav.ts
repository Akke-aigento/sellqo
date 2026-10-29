// ONDERBALK-1 — regels van de gsm-onderbalk, gedeeld door de balk (AdminMobileBottomNav) en het
// instellingenscherm (Instellingen › Mijn onderbalk). Puur, zodat het getest kan worden.
import type { NavItem } from './sidebarConfig';

export const BOTTOM_NAV_MAX = 5;
export const BOTTOM_NAV_MIN = 2;

export interface BottomNavContext {
  horeca: boolean;
  webshop: boolean;
  events: boolean;
}

/**
 * Standaard per spoor (wie niets kiest).
 * - Horeca zonder webshop of events (WANDELING): Vandaag · Kassa · Keuken · Kaart.
 * - Horeca met webshop of events: Dashboard · Bestellingen · Keuken · Kaart.
 * - Anders: Dashboard · Bestellingen · Producten · Inbox.
 */
export function defaultBottomNavIds(c: BottomNavContext): string[] {
  if (c.horeca && !c.webshop && !c.events) return ['dashboard', 'pos', 'kitchen', 'ordering'];
  if (c.horeca) return ['dashboard', 'orders', 'kitchen', 'ordering'];
  return ['dashboard', 'orders', 'products', 'inbox'];
}

/** Korte labels voor items met een lange menunaam; de pil is smal. */
const SHORT_LABEL: Record<string, string> = {
  pos: 'navigation.bottom.kassa',
  kitchen: 'navigation.bottom.kitchen',
  ordering: 'navigation.bottom.menu',
};

/** Label in de balk. Een horecazaak noemt het dashboard "Vandaag". */
export function bottomNavLabelKey(item: Pick<NavItem, 'id' | 'titleKey'>, c: BottomNavContext): string {
  if (item.id === 'dashboard' && c.horeca) return 'navigation.bottom.today';
  return SHORT_LABEL[item.id] ?? item.titleKey;
}

/**
 * Waar een tik naartoe gaat. Kassa opent bij een horecazaak zonder webshop de kassa-app zelf (/kassa);
 * met een webshop blijft het het kassabeheer (daar opent de klassieke kassa per terminal).
 */
export function bottomNavUrl(item: Pick<NavItem, 'id' | 'url'>, c: BottomNavContext): string {
  if (item.id === 'pos' && c.horeca && !c.webshop) return '/kassa';
  return item.url;
}

/**
 * De id's die in de balk komen: de eigen keuze (zonder onbekende of niet-toegelaten items, zonder
 * dubbels, hoogstens 5), anders de standaard. Blijft er van de keuze minder dan 2 over (rechten of
 * pakket veranderd), dan de standaard: nooit een balk met één knop of dode knoppen.
 */
export function resolveBottomNavIds(chosen: readonly string[] | null | undefined, allowed: (id: string) => boolean, c: BottomNavContext): string[] {
  const own = [...new Set((chosen ?? []).filter((id) => typeof id === 'string' && allowed(id)))].slice(0, BOTTOM_NAV_MAX);
  if (own.length >= BOTTOM_NAV_MIN) return own;
  return defaultBottomNavIds(c).filter(allowed);
}
