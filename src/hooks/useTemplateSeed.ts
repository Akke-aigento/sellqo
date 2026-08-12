import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import {
  SHOP_PATH_PLACEHOLDER,
  type Theme,
  type TemplateSeedDefinition,
} from '@/types/storefront';

export interface SeedOutcome {
  sectionsCreated: number;
  sectionsArchived: number;
  pagesCreated: number;
  /** Pagina's die al bestonden en dus ongemoeid zijn gelaten. */
  pagesSkipped: string[];
}

/**
 * Vervangt {{shop}} door het winkelpad van deze tenant, ook diep in objecten.
 *
 * Bewust niet generiek: een recursieve generic liet `tsc` hier vastlopen op
 * inferentie. `unknown` in en uit, casten gebeurt op de aanroepplek.
 */
function resolveShopPaths(value: unknown, shopPath: string): unknown {
  if (typeof value === 'string') {
    return value.split(SHOP_PATH_PLACEHOLDER).join(shopPath);
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveShopPaths(v, shopPath));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveShopPaths(v, shopPath);
    }
    return out;
  }
  return value;
}

/**
 * Past een template toe op de huidige tenant.
 *
 * Nooit destructief: bestaande homepage-secties worden op `is_visible = false`
 * gezet in plaats van verwijderd, en pagina's met een slug die al bestaat
 * blijven onaangeroerd. De tenant kan dus altijd terug.
 */
export function useTemplateSeed() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  const applyTemplate = useMutation({
    mutationFn: async (theme: Theme): Promise<SeedOutcome> => {
      if (!currentTenant?.id) throw new Error('Geen winkel geselecteerd');

      const seed = theme.seed_definition as TemplateSeedDefinition | null | undefined;
      if (!seed) throw new Error('Dit theme heeft geen bouwplan');

      const shopPath = `/shop/${currentTenant.slug}`;
      const defaults = theme.default_settings;

      // 1. Theme-keuze en defaults. Dit zet theme_id — de kolom die tot nu toe
      //    leeg bleef en waardoor de publiceerknop ooit onbruikbaar was.
      const themePayload = {
        theme_id: theme.id,
        primary_color: defaults.primary_color,
        secondary_color: defaults.secondary_color,
        accent_color: defaults.accent_color,
        background_color: defaults.background_color,
        text_color: defaults.text_color,
        heading_font: defaults.heading_font,
        body_font: defaults.body_font,
        header_style: defaults.header_style,
        product_card_style: defaults.product_card_style,
        products_per_row: defaults.products_per_row,
        show_breadcrumbs: defaults.show_breadcrumbs,
        show_wishlist: defaults.show_wishlist,
        brand_color: defaults.brand_color ?? defaults.primary_color,
        theme_mode: defaults.theme_mode ?? 'light',
        theme_style: defaults.theme_style ?? 'modern',
        updated_at: new Date().toISOString(),
      };

      // Niet elke tenant heeft gegarandeerd een rij: create-tenant maakt er wel
      // één aan, maar tenants van vóór die functie mogelijk niet.
      const { data: existingSettings, error: lookupError } = await supabase
        .from('tenant_theme_settings')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();
      if (lookupError) throw lookupError;

      const { error: settingsError } = existingSettings
        ? await supabase
            .from('tenant_theme_settings')
            .update(themePayload)
            .eq('tenant_id', currentTenant.id)
        : await supabase
            .from('tenant_theme_settings')
            .insert({ ...themePayload, tenant_id: currentTenant.id });
      if (settingsError) throw settingsError;

      // 2. Bestaande secties verbergen in plaats van verwijderen.
      const { data: existingSections, error: fetchSectionsError } = await supabase
        .from('homepage_sections')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .eq('is_visible', true);
      if (fetchSectionsError) throw fetchSectionsError;

      let sectionsArchived = 0;
      if (existingSections && existingSections.length > 0) {
        const { error: archiveError } = await supabase
          .from('homepage_sections')
          .update({ is_visible: false, updated_at: new Date().toISOString() })
          .eq('tenant_id', currentTenant.id)
          .eq('is_visible', true);
        if (archiveError) throw archiveError;
        sectionsArchived = existingSections.length;
      }

      // 3. Secties uit het bouwplan aanmaken.
      const sectionRows = seed.sections.map((s) => ({
        tenant_id: currentTenant.id,
        section_type: s.section_type,
        title: s.title,
        subtitle: s.subtitle,
        content: resolveShopPaths(s.content, shopPath) as unknown as Json,
        settings: s.settings as unknown as Json,
        sort_order: s.sort_order,
        is_visible: s.is_visible,
      }));

      if (sectionRows.length > 0) {
        const { error: insertSectionsError } = await supabase
          .from('homepage_sections')
          .insert(sectionRows);
        if (insertSectionsError) throw insertSectionsError;
      }

      // 4. Pagina's — bestaande slugs met rust laten, want daar zit content van
      //    de tenant in. UNIQUE(tenant_id, slug) zou hier anders ook botsen.
      const { data: existingPages, error: fetchPagesError } = await supabase
        .from('storefront_pages')
        .select('slug')
        .eq('tenant_id', currentTenant.id);
      if (fetchPagesError) throw fetchPagesError;

      const existingSlugs = new Set((existingPages ?? []).map((p) => p.slug));
      const pagesToCreate = seed.pages.filter((p) => !existingSlugs.has(p.slug));
      const pagesSkipped = seed.pages
        .filter((p) => existingSlugs.has(p.slug))
        .map((p) => p.title);

      if (pagesToCreate.length > 0) {
        const { error: insertPagesError } = await supabase
          .from('storefront_pages')
          .insert(
            pagesToCreate.map((p) => ({
              tenant_id: currentTenant.id,
              slug: p.slug,
              title: p.title,
              content: resolveShopPaths(p.content, shopPath) as string,
              is_published: true,
              show_in_nav: p.show_in_nav,
              nav_order: p.nav_order,
            }))
          );
        if (insertPagesError) throw insertPagesError;
      }

      return {
        sectionsCreated: sectionRows.length,
        sectionsArchived,
        pagesCreated: pagesToCreate.length,
        pagesSkipped,
      };
    },
    onSuccess: (outcome) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-theme-settings', currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['homepage-sections', currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['storefront-pages', currentTenant?.id] });

      const parts = [`${outcome.sectionsCreated} secties`];
      if (outcome.pagesCreated > 0) parts.push(`${outcome.pagesCreated} pagina's`);
      toast.success(`Template toegepast — ${parts.join(' en ')} aangemaakt`);

      if (outcome.sectionsArchived > 0) {
        toast.info(
          `${outcome.sectionsArchived} bestaande secties zijn verborgen, niet verwijderd. Je vindt ze terug bij Homepage.`
        );
      }
      if (outcome.pagesSkipped.length > 0) {
        toast.info(
          `Bestaande pagina's ongewijzigd gelaten: ${outcome.pagesSkipped.join(', ')}`
        );
      }
    },
    onError: (error: Error) => {
      toast.error(`Template toepassen mislukt: ${error.message}`);
    },
  });

  return { applyTemplate };
}
