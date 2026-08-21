import {
  Package,
  GraduationCap,
  Sun,
  Camera,
  MessageSquareQuote,
  Lightbulb,
  CalendarHeart,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

/**
 * Vaste categorie-startset voor de Dagelijkse Menukaart (MENU-1).
 *
 * CONTRACT — lees dit vóór je hier iets toevoegt:
 *
 * Dit bestand bevat GEEN generatie-instructies voor de AI, en dat is een
 * bewuste keuze. Een Deno edge-functie kan niet uit `src/` importeren en `src/`
 * niet uit `supabase/functions/`; de instructies op beide plekken zetten levert
 * twee waarheden op die gaan afdrijven.
 *
 * De verdeling ligt daarom zo:
 *   - de frontend stuurt alleen categorie-`key` + aantal;
 *   - de promptinstructie per vaste categorie leeft in de edge-functie
 *     (batch 2, `supabase/functions/_shared/contentCategories.ts`);
 *   - voor eigen categorieën is `tenant_content_categories.instructions` de
 *     instructie, ingevuld door de tenant zelf.
 *
 * `key` is een databasesleutel: hij komt terecht in
 * `tenant_brand_dna.menu_counts` en mag daarom nooit hernoemd worden. Een
 * categorie afvoeren doe je door hem hier weg te halen; bestaande tellers met
 * die sleutel worden dan genegeerd, niet gemigreerd.
 */
export interface ContentMenuCategory {
  /** Stabiele sleutel in `tenant_brand_dna.menu_counts`. Nooit hernoemen. */
  key: string;
  /** i18n-key voor het label. */
  labelKey: string;
  /** i18n-key voor de uitleg onder het label. */
  descriptionKey: string;
  /** Waarde waarmee de teller start als de tenant nog niets heeft opgeslagen. */
  defaultCount: number;
  icon: LucideIcon;
  /**
   * De vrije AI-categorie. Krijgt in de UI een eigen behandeling: er is geen
   * vaste instructie, de AI kiest zelf een invalshoek.
   */
  isFreeform?: boolean;
}

export const CONTENT_MENU_CATEGORIES: readonly ContentMenuCategory[] = [
  {
    key: 'product_post',
    labelKey: 'content_menu.categories.product_post.label',
    descriptionKey: 'content_menu.categories.product_post.description',
    defaultCount: 2,
    icon: Package,
  },
  {
    key: 'educational',
    labelKey: 'content_menu.categories.educational.label',
    descriptionKey: 'content_menu.categories.educational.description',
    defaultCount: 1,
    icon: GraduationCap,
  },
  {
    key: 'lifestyle',
    labelKey: 'content_menu.categories.lifestyle.label',
    descriptionKey: 'content_menu.categories.lifestyle.description',
    defaultCount: 1,
    icon: Sun,
  },
  {
    key: 'behind_the_scenes',
    labelKey: 'content_menu.categories.behind_the_scenes.label',
    descriptionKey: 'content_menu.categories.behind_the_scenes.description',
    defaultCount: 1,
    icon: Camera,
  },
  {
    key: 'customer_story',
    labelKey: 'content_menu.categories.customer_story.label',
    descriptionKey: 'content_menu.categories.customer_story.description',
    defaultCount: 1,
    icon: MessageSquareQuote,
  },
  {
    key: 'tip_howto',
    labelKey: 'content_menu.categories.tip_howto.label',
    descriptionKey: 'content_menu.categories.tip_howto.description',
    defaultCount: 1,
    icon: Lightbulb,
  },
  {
    key: 'seasonal',
    labelKey: 'content_menu.categories.seasonal.label',
    descriptionKey: 'content_menu.categories.seasonal.description',
    defaultCount: 0,
    icon: CalendarHeart,
  },
  {
    key: 'surprise_me',
    labelKey: 'content_menu.categories.surprise_me.label',
    descriptionKey: 'content_menu.categories.surprise_me.description',
    defaultCount: 1,
    icon: Sparkles,
    isFreeform: true,
  },
] as const;

/** Snelle lookup op de gereserveerde sleutels — gebruikt bij slug-validatie. */
export const RESERVED_CATEGORY_KEYS: ReadonlySet<string> = new Set(
  CONTENT_MENU_CATEGORIES.map((c) => c.key),
);

/** Bovengrens per teller in de UI. Puur een rem, geen databaseregel. */
export const MAX_COUNT_PER_CATEGORY = 5;

/**
 * Formaat-nadruk voor het hele menu.
 *
 * Deze waarden staan één-op-één in de CHECK-constraint
 * `tenant_brand_dna_format_emphasis_check`. Een waarde toevoegen vraagt dus
 * óók een migratie die de constraint vervangt.
 */
export const FORMAT_EMPHASIS_VALUES = [
  'mixed',
  'short',
  'long',
  'visual',
  'carousel',
] as const;

export type FormatEmphasis = (typeof FORMAT_EMPHASIS_VALUES)[number];

export const DEFAULT_FORMAT_EMPHASIS: FormatEmphasis = 'mixed';

/** i18n-key voor een formaat-nadrukwaarde. */
export const formatEmphasisLabelKey = (value: FormatEmphasis): string =>
  `content_menu.format_emphasis.${value}.label`;

/** i18n-key voor de uitleg bij een formaat-nadrukwaarde. */
export const formatEmphasisDescriptionKey = (value: FormatEmphasis): string =>
  `content_menu.format_emphasis.${value}.description`;

/**
 * Maakt een slug uit een vrij ingevoerde categorienaam. Diakrieten eruit,
 * alles wat geen letter of cijfer is wordt een liggend streepje.
 */
export function slugifyCategoryName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}
