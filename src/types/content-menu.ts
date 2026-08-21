import type { FormatEmphasis } from '@/config/contentMenuCategories';

/**
 * Rijtypes voor de Dagelijkse Menukaart (MENU-1).
 *
 * Deze staan hier met de hand omdat `tenant_brand_dna` en
 * `tenant_content_categories` pas in `src/integrations/supabase/types.ts`
 * verschijnen nadat de migratie gedraaid is én de types opnieuw gegenereerd
 * zijn. Zodra dat gebeurd is, mag dit bestand vervangen worden door
 * `Database['public']['Tables'][...]['Row']`; tot dan is dit de enige
 * beschrijving van het schema aan de frontendkant.
 *
 * Houd deze velden één-op-één met
 * `supabase/migrations/20260820100000_menu1_brand_dna.sql`.
 */

/** Benoemde hashtag-sets: { "<setnaam>": ["#tag", ...] }. */
export type HashtagSets = Record<string, string[]>;

/** Tellers per categorie: { "<categorie-key of slug>": <aantal> }. */
export type MenuCounts = Record<string, number>;

export interface TenantBrandDna {
  id: string;
  tenant_id: string;
  brand_mission: string | null;
  target_audience: string | null;
  tone_keywords: string[];
  usps: string[];
  dos: string | null;
  donts: string | null;
  themes: string[];
  hashtag_sets: HashtagSets;
  free_dna: string | null;
  menu_counts: MenuCounts;
  format_emphasis: FormatEmphasis;
  created_at: string;
  updated_at: string;
}

/** Wat het formulier schrijft — alles behalve de door de database beheerde velden. */
export type TenantBrandDnaInput = Omit<
  TenantBrandDna,
  'id' | 'tenant_id' | 'created_at' | 'updated_at'
>;

export interface TenantContentCategory {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  /** Verplicht, ook op databaseniveau (CHECK op lege string). */
  instructions: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type TenantContentCategoryInput = Pick<
  TenantContentCategory,
  'slug' | 'name' | 'instructions' | 'sort_order'
>;
