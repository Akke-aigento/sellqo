// MENUKAART-PRINT-1 — de papieren menukaart: welke gerechten erop staan, de instellingen per zaak
// en de volgorde van de pagina's op de vellen (imposition). Puur, zonder React of pdf-lib, zodat
// het met unit tests vast te leggen is. De PDF zelf: src/utils/menuCardPdf.ts.
import { ALLERGENS } from '@/components/admin/storefront/food/allergens';

/** Drie sjablonen (Akke, 6 nov 2026). */
export const MENU_PRINT_TEMPLATES = ['booklet_a5', 'a4', 'photo_cover'] as const;
export type MenuPrintTemplate = (typeof MENU_PRINT_TEMPLATES)[number];

export interface MenuPrintOptions {
  descriptions: boolean;
  allergens: boolean;
  /** Achterkant: adres, telefoon en openingsuren. */
  info: boolean;
  /** Achterkant: QR naar de online kaart. */
  qr: boolean;
  /** Ondertitel op de kaft (bv. "Sinds 1998"); leeg = geen. */
  subtitle: string;
  /** Taal van de vaste teksten op de kaart ("Allergenen", "Scan …"); leeg = de taal van het beheer. */
  language: string;
}

export interface MenuPrintSettings {
  template: MenuPrintTemplate;
  options: MenuPrintOptions;
  /** Kaftfoto (sjabloon photo_cover): een publieke afbeeldings-URL uit de mediabibliotheek of een product. */
  coverImageUrl: string | null;
}

export const DEFAULT_MENU_PRINT_OPTIONS: MenuPrintOptions = {
  descriptions: true, allergens: true, info: true, qr: true, subtitle: '', language: '',
};
export const DEFAULT_MENU_PRINT_SETTINGS: MenuPrintSettings = {
  template: 'booklet_a5', options: DEFAULT_MENU_PRINT_OPTIONS, coverImageUrl: null,
};
export const MENU_PRINT_SUBTITLE_MAX = 60;

/** Een rij uit de database (of localStorage) naar geldige instellingen; onbekende waarden = standaard. */
export function parseMenuPrintSettings(raw: unknown): MenuPrintSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const o = (r.options && typeof r.options === 'object' ? r.options : {}) as Record<string, unknown>;
  const bool = (k: keyof MenuPrintOptions) => (typeof o[k] === 'boolean' ? (o[k] as boolean) : (DEFAULT_MENU_PRINT_OPTIONS[k] as boolean));
  const template = MENU_PRINT_TEMPLATES.includes(r.template as MenuPrintTemplate) ? (r.template as MenuPrintTemplate) : DEFAULT_MENU_PRINT_SETTINGS.template;
  const cover = r.cover_image_url ?? r.coverImageUrl;
  return {
    template,
    options: {
      descriptions: bool('descriptions'),
      allergens: bool('allergens'),
      info: bool('info'),
      qr: bool('qr'),
      subtitle: typeof o.subtitle === 'string' ? o.subtitle.slice(0, MENU_PRINT_SUBTITLE_MAX) : '',
      language: typeof o.language === 'string' ? o.language : '',
    },
    coverImageUrl: typeof cover === 'string' && /^https:\/\//.test(cover) ? cover : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Inhoud: dezelfde selectie als het QR-menu (storefront-api get_products, channel 'menu'):
// actief, niet verborgen in de webshop, kanaal "menu" of "tafel", en niet in een verborgen
// categorie. "Uitverkocht vandaag" (sold_out_until) en dagschotels (daily_special_until) tellen
// bewust NIET: een papieren kaart gaat maanden mee. Een dagschotel is een gewoon product en
// staat er dus gewoon op als hij op de kaart staat.
// ---------------------------------------------------------------------------------------------

export interface MenuSourceCategory {
  id: string;
  name: string;
  sort_order: number | null;
  is_active: boolean | null;
  hide_from_storefront?: boolean | null;
}

export interface MenuSourceProduct {
  id: string;
  name: string;
  price: number | string;
  category_id: string | null;
  is_active: boolean | null;
  hide_from_storefront?: boolean | null;
  channels: string[] | null;
  menu_position: number | null;
  short_description?: string | null;
  description?: string | null;
  allergens?: string[] | null;
  dietary?: string[] | null;
  featured_image?: string | null;
}

export interface MenuItem {
  name: string;
  price: number;
  description: string;
  /** Allergeennummers 1–14, in de volgorde van de EU-lijst (ALLERGENS). */
  allergens: number[];
  /** Dieetcodes uit DIETARY (vegetarian, vegan, …). */
  dietary: string[];
}

export interface MenuSection { title: string; items: MenuItem[] }

/** Zoals channelAllows in storefront-api: kanaal 'menu' of 'table'. */
export const onPrintedMenu = (p: MenuSourceProduct) =>
  p.is_active === true && p.hide_from_storefront !== true && (p.channels ?? []).some((c) => c === 'menu' || c === 'table');

/** HTML uit de productomschrijving naar platte tekst, ingekort tot ±`max` tekens op een woordgrens. */
export function plainDescription(html: string | null | undefined, max = 220): string {
  const text = (html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|li|div|h\d)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

const byMenu = (a: MenuSourceProduct, b: MenuSourceProduct) =>
  (a.menu_position ?? Number.MAX_SAFE_INTEGER) - (b.menu_position ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'nl');

export function buildMenuSections(categories: MenuSourceCategory[], products: MenuSourceProduct[], otherTitle: string): MenuSection[] {
  const hidden = new Set(categories.filter((c) => c.is_active === false || c.hide_from_storefront === true).map((c) => c.id));
  const known = new Set(categories.map((c) => c.id));
  const toItem = (p: MenuSourceProduct): MenuItem => ({
    name: p.name.trim(),
    price: Number(p.price),
    description: plainDescription(p.short_description?.trim() ? p.short_description : p.description),
    allergens: ALLERGENS.map((a, i) => ((p.allergens ?? []).includes(a) ? i + 1 : 0)).filter(Boolean),
    dietary: [...(p.dietary ?? [])],
  });
  const shown = products.filter((p) => onPrintedMenu(p) && !(p.category_id && hidden.has(p.category_id)));
  const ordered = [...categories].sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'nl'));
  const sections: MenuSection[] = ordered
    .filter((c) => !hidden.has(c.id))
    .map((c) => ({ title: c.name.trim(), items: shown.filter((p) => p.category_id === c.id).sort(byMenu).map(toItem) }))
    .filter((s) => s.items.length > 0);
  const loose = shown.filter((p) => !p.category_id || !known.has(p.category_id)).sort(byMenu).map(toItem);
  if (loose.length) sections.push({ title: otherTitle, items: loose });
  return sections;
}

// ---------------------------------------------------------------------------------------------
// Imposition. Een boekje (rugnieten of los gevouwen) van n pagina's, n een veelvoud van 4:
// vel s (0-based) heeft op de voorkant links n−2s en rechts 1+2s, op de achterkant links 2+2s
// en rechts n−1−2s. Druk dubbelzijdig af, "omslaan langs de korte kant"; leg de vellen in
// volgorde op elkaar en vouw ze samen dubbel. Pagina's 1-based, zoals op het papier.
// ---------------------------------------------------------------------------------------------

export const padTo = (n: number, multiple: number) => Math.max(multiple, Math.ceil(n / multiple) * multiple);

export interface SheetSide { left: number; right: number }
export interface Sheet { front: SheetSide; back: SheetSide }

export function bookletSheets(pageCount: number): Sheet[] {
  if (pageCount < 4 || pageCount % 4 !== 0) throw new Error(`booklet: ${pageCount} pagina's is geen veelvoud van 4`);
  const n = pageCount;
  return Array.from({ length: n / 4 }, (_, s) => ({
    front: { left: n - 2 * s, right: 1 + 2 * s },
    back: { left: 2 + 2 * s, right: n - 1 - 2 * s },
  }));
}

/** De logische pagina's per PDF-pagina in afdrukvolgorde (voor, achter, voor, …). */
export function bookletPrintOrder(pageCount: number): [number, number][] {
  return bookletSheets(pageCount).flatMap((s) => [[s.front.left, s.front.right], [s.back.left, s.back.right]] as [number, number][]);
}

/**
 * Hoeveel pagina's in totaal: kaft + binnenpagina's + achterkant, opgevuld tot een veelvoud van
 * 4 (boekje) of 2 (losse A4-vellen, dubbelzijdig). Opvulpagina's komen vlak vóór de achterkant.
 */
export function totalPages(template: MenuPrintTemplate, contentPages: number): number {
  return padTo(contentPages + 2, template === 'a4' ? 2 : 4);
}
