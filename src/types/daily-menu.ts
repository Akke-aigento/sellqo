/**
 * Types voor het dagelijkse menu (MENU-2).
 *
 * De kaarten worden opgeslagen als rijen in `ai_generated_content` met
 * `content_type = 'menu_card'`. Alles wat specifiek is voor een menukaart zit
 * in de `metadata`-kolom (jsonb) — er is bewust geen schemawijziging voor
 * gedaan. Deze types beschrijven die metadata-vorm.
 */

/** Toegestane kaartformaten. Spiegelt CARD_FORMATS in _shared/contentCategories.ts. */
export const CARD_FORMATS = ['post', 'reel', 'story', 'carousel'] as const;
export type CardFormat = (typeof CARD_FORMATS)[number];

export interface MenuCardMetadata {
  /** Groepeert de kaarten van één generatie-ronde. */
  menu_run_id: string;
  card_index: number;
  category_key: string;
  category_label: string;
  is_custom: boolean;
  is_freeform: boolean;
  card_format: CardFormat;
  format_reason: string | null;
  hashtags: string[];
  /** Klaargezet voor de beeldknop; niet automatisch uitgevoerd. */
  image_prompt: string | null;
  /** Alleen gevuld bij de vrije categorie. */
  angle_reason: string | null;
  source: 'daily_menu';
  /** Gezet wanneer de tenant de kaart weggooit — de rij blijft bestaan. */
  discarded_at?: string;
  /** Gevuld nadat er beeld bij gegenereerd is. */
  image_url?: string;
}

/** Een kaart zoals de UI hem gebruikt: de rij plus de uitgepakte metadata. */
export interface MenuCard {
  id: string;
  tenant_id: string;
  platform: string | null;
  title: string | null;
  content_text: string | null;
  image_urls: string[];
  product_ids: string[];
  language: string | null;
  is_used: boolean | null;
  created_at: string;
  metadata: MenuCardMetadata;
}

/** Foutcodes die de edge-functie teruggeeft, zodat de UI gericht kan reageren. */
export type DailyMenuErrorCode =
  | 'brand_dna_missing'
  | 'menu_empty'
  | 'insufficient_credits'
  | 'rate_limit'
  | 'no_usable_cards';

export interface DailyMenuResult {
  menuRunId: string;
  requested: number;
  generated: number;
  skipped: number;
  creditsUsed: number;
}
