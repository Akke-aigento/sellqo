// HORECA-INSTELLINGEN-1 — "Mijn zaak": de instellingen van een horecazaak zonder webshop of events,
// geordend zoals een cafébaas denkt. Eén plek per instelling; elke groep heeft tabs bovenaan die je
// kan deeplinken met /admin/settings?section=<groep>&tab=<tab>.
//
// Puur (geen React), zodat de zoekbalk (settingsIndex.ts), de redirects van de oude plekken en de
// tests dezelfde bron lezen. Welke component bij een tab hoort, staat in
// src/components/admin/mijnzaak/MijnZaakTabs.tsx.
import type { Resource } from '@/hooks/useCan';

export const SETTINGS_PATH = '/admin/settings';
export const STAFF_PATH = '/admin/personeel';
export const RESERVATIONS_PATH = '/admin/reservaties';
export const KAART_PATH = '/admin/bestellen';
export const FLOOR_EDIT_PATH = '/admin/zaal?tab=bewerken';

export interface ZaakTab {
  id: string;
  /** i18n-key van het tablabel. */
  labelKey: string;
  /** Leesrecht dat nodig is (zelfde als op de oude plek). Leeg = iedereen die Instellingen opent. */
  requiredRead?: Resource;
  /** Enkel zaakvoerders (tenant_admin of platform_admin), zoals de oude sectie. */
  adminOnly?: boolean;
}

export interface ZaakGroup {
  id: string;
  titleKey: string;
  descKey: string;
  tabs: ZaakTab[];
}

/** De zes groepen + "Jij" (je eigen account), in de volgorde van het scherm. */
export const ZAAK_GROUPS: ZaakGroup[] = [
  {
    id: 'zaak', titleKey: 'mijnZaak.groups.zaak.title', descKey: 'mijnZaak.groups.zaak.desc',
    tabs: [
      { id: 'gegevens', labelKey: 'mijnZaak.tabs.gegevens', requiredRead: 'settings_general' },
      { id: 'uren', labelKey: 'mijnZaak.tabs.uren', requiredRead: 'settings_general' },
      { id: 'merk', labelKey: 'mijnZaak.tabs.merk', requiredRead: 'settings_general' },
      { id: 'website', labelKey: 'mijnZaak.tabs.website', requiredRead: 'themes' },
    ],
  },
  {
    id: 'gasten', titleKey: 'mijnZaak.groups.gasten.title', descKey: 'mijnZaak.groups.gasten.desc',
    tabs: [
      // Zelfde recht als de oude plek (Kaart › Instellen, route /admin/bestellen = orders).
      { id: 'qr', labelKey: 'mijnZaak.tabs.qr', requiredRead: 'orders' },
      { id: 'afhalen', labelKey: 'mijnZaak.tabs.afhalen', requiredRead: 'orders' },
      { id: 'reserveren', labelKey: 'mijnZaak.tabs.reserveren', requiredRead: 'orders' },
      { id: 'berichten', labelKey: 'mijnZaak.tabs.berichten', requiredRead: 'settings_general' },
    ],
  },
  {
    id: 'betalen', titleKey: 'mijnZaak.groups.betalen.title', descKey: 'mijnZaak.groups.betalen.desc',
    tabs: [
      // Kassa › Betalen stond op /admin/pos (pos); Stripe op Instellingen › Betalingen (settings_financial).
      { id: 'kassa', labelKey: 'mijnZaak.tabs.kassa', requiredRead: 'pos' },
      { id: 'online', labelKey: 'mijnZaak.tabs.online', requiredRead: 'settings_financial' },
      { id: 'fooi', labelKey: 'mijnZaak.tabs.fooi', requiredRead: 'pos' },
      { id: 'terminal', labelKey: 'mijnZaak.tabs.terminal', requiredRead: 'pos' },
    ],
  },
  {
    id: 'zaal-keuken', titleKey: 'mijnZaak.groups.zaalKeuken.title', descKey: 'mijnZaak.groups.zaalKeuken.desc',
    tabs: [
      { id: 'zaalplan', labelKey: 'mijnZaak.tabs.zaalplan', requiredRead: 'orders' },
      { id: 'posten', labelKey: 'mijnZaak.tabs.posten', requiredRead: 'orders' },
      { id: 'printers', labelKey: 'mijnZaak.tabs.printers', requiredRead: 'pos' },
      { id: 'keukenschermen', labelKey: 'mijnZaak.tabs.keukenschermen', requiredRead: 'orders' },
    ],
  },
  {
    id: 'toestellen', titleKey: 'mijnZaak.groups.toestellen.title', descKey: 'mijnZaak.groups.toestellen.desc',
    tabs: [
      { id: 'kassas', labelKey: 'mijnZaak.tabs.kassas', requiredRead: 'pos' },
      { id: 'vergrendeling', labelKey: 'mijnZaak.tabs.vergrendeling', requiredRead: 'pos' },
      { id: 'meldingen', labelKey: 'mijnZaak.tabs.meldingen', requiredRead: 'pos' },
    ],
  },
  {
    id: 'geld', titleKey: 'mijnZaak.groups.geld.title', descKey: 'mijnZaak.groups.geld.desc',
    tabs: [
      { id: 'btw', labelKey: 'mijnZaak.tabs.btw', requiredRead: 'settings_financial' },
      { id: 'facturen', labelKey: 'mijnZaak.tabs.facturen', requiredRead: 'settings_financial' },
      { id: 'boekhouding', labelKey: 'mijnZaak.tabs.boekhouding', requiredRead: 'settings_financial' },
      { id: 'plan', labelKey: 'mijnZaak.tabs.plan', requiredRead: 'platform_billing' },
    ],
  },
  {
    // "Jij": persoonlijk, zoals vroeger Mijn profiel / Mijn meldingen / Mijn onderbalk (geen recht nodig).
    id: 'jij', titleKey: 'mijnZaak.groups.jij.title', descKey: 'mijnZaak.groups.jij.desc',
    tabs: [
      { id: 'profiel', labelKey: 'mijnZaak.tabs.profiel' },
      { id: 'mijn-meldingen', labelKey: 'mijnZaak.tabs.mijnMeldingen' },
      { id: 'onderbalk', labelKey: 'mijnZaak.tabs.onderbalk' },
    ],
  },
];

/** Personeel (/admin/personeel): tabs bovenaan, ?tab=… */
export const STAFF_TABS: ZaakTab[] = [
  { id: 'pin', labelKey: 'mijnZaak.staff.tab_pin', requiredRead: 'pos' },
  { id: 'uren', labelKey: 'mijnZaak.staff.tab_hours', requiredRead: 'pos' },
  { id: 'beheerders', labelKey: 'mijnZaak.staff.tab_admins', adminOnly: true },
];

/**
 * Tabs van de Kaart (/admin/bestellen) voor horeca-only. QR, afhalen & leveren, posten en
 * reservaties zijn verhuisd (zie KAART_MOVED); gerechten, extra's en allergenen zijn inhoud en blijven.
 */
export const KAART_TABS_HORECA_ONLY = ['kaart', 'overview', 'extras', 'allergens'] as const;

export const findGroup = (id: string | null | undefined): ZaakGroup | undefined => ZAAK_GROUPS.find((g) => g.id === id);

/** Url van een groep/tab in Mijn zaak. Zonder groep: het overzicht met de checklist. */
export function mijnZaakUrl(section?: string, tab?: string, anchor?: string): string {
  if (!section) return SETTINGS_PATH;
  const q = new URLSearchParams({ section });
  if (tab) q.set('tab', tab);
  return `${SETTINGS_PATH}?${q.toString()}${anchor ? `#${anchor}` : ''}`;
}

export const staffUrl = (tab?: string) => (tab && tab !== 'pin' ? `${STAFF_PATH}?tab=${tab}` : STAFF_PATH);

/**
 * Oude ?section= van Instellingen → nieuwe plek (horeca-only). Een onbekende sectie gaat naar het
 * overzicht. `hash` is het anker van de oude link (#openingsuren stond op Bedrijfsgegevens).
 */
export function legacySettingsTarget(section: string, hash = ''): string | null {
  if (findGroup(section)) return null; // al een nieuwe groep
  const h = hash.replace(/^#/, '');
  switch (section) {
    case 'profile': return mijnZaakUrl('jij', 'profiel');
    case 'my-notifications': return mijnZaakUrl('jij', 'mijn-meldingen');
    case 'bottom-nav': return mijnZaakUrl('jij', 'onderbalk');
    case 'team': return staffUrl('beheerders');
    case 'company': return h === 'openingsuren' ? mijnZaakUrl('zaak', 'uren') : mijnZaakUrl('zaak', 'gegevens');
    case 'branding': return mijnZaakUrl('zaak', 'merk');
    case 'domain': return mijnZaakUrl('zaak', 'website');
    case 'payments':
    case 'transactions': return mijnZaakUrl('betalen', 'online');
    case 'tax':
    case 'vat_rates': return mijnZaakUrl('geld', 'btw');
    case 'invoicing':
    case 'peppol':
    case 'compliance': return mijnZaakUrl('geld', 'facturen');
    case 'accounting': return mijnZaakUrl('geld', 'boekhouding');
    case 'modules': return mijnZaakUrl('geld', 'plan');
    case 'shop-notifications': return mijnZaakUrl('toestellen', 'meldingen');
    case 'customer-communication': return mijnZaakUrl('gasten', 'berichten');
    case 'more-tools': return `${SETTINGS_PATH}#meer`;
    // 'horeca' (het oude overzicht) en alles wat horeca-only niet heeft: het overzicht.
    default: return SETTINGS_PATH;
  }
}

/** Oude /admin/pos?tab=… → nieuwe plek (horeca-only). */
export function legacyPosTarget(tab: string | null): string {
  switch (tab) {
    case 'personeel': return STAFF_PATH;
    case 'betalen': return mijnZaakUrl('betalen', 'kassa');
    case 'printers': return mijnZaakUrl('zaal-keuken', 'printers');
    default: return mijnZaakUrl('toestellen', 'kassas');
  }
}

/** Oude /admin/bestellen?tab=… die verhuisd zijn (horeca-only); null = blijft op de Kaart. */
export function legacyKaartTarget(tab: string | null): string | null {
  switch (tab) {
    case 'qr': return mijnZaakUrl('gasten', 'qr');
    case 'webshop': return mijnZaakUrl('gasten', 'afhalen');
    case 'posten': return mijnZaakUrl('zaal-keuken', 'posten');
    case 'reservaties': return RESERVATIONS_PATH;
    default: return null;
  }
}

/**
 * Een oude interne link (Kassabeheer, Kaart-instellingen, Instellingen-sectie) → de nieuwe plek voor
 * horeca-only. Andere paden komen ongewijzigd terug. De pagina's sturen zelf ook door (vangnet); dit
 * laat gedeelde schermen meteen naar de juiste plek linken.
 */
export function resolveLegacyHref(href: string): string {
  const [pathAndQuery, hash = ''] = href.split('#');
  const [path, query = ''] = pathAndQuery.split('?');
  const q = new URLSearchParams(query);
  if (path === '/admin/pos') return legacyPosTarget(q.get('tab'));
  if (path === KAART_PATH) return legacyKaartTarget(q.get('tab')) ?? href;
  if (path === SETTINGS_PATH) {
    const section = q.get('section');
    if (!section) return href;
    return legacySettingsTarget(section, hash) ?? href;
  }
  return href;
}
