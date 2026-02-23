import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import type { 
  Theme, 
  TenantThemeSettings, 
  StorefrontPage, 
  HomepageSection,
  ThemeSettings,
  SocialLinks,
  HomepageSectionContent,
  HomepageSectionSettings
} from '@/types/storefront';

// Helper to convert DB row to Theme type
function mapDbTheme(row: any): Theme {
  return {
    ...row,
    default_settings: row.default_settings as ThemeSettings,
  };
}

// Helper to convert DB row to TenantThemeSettings type  
function mapDbThemeSettings(row: any): TenantThemeSettings {
  return {
    ...row,
    social_links: (row.social_links || {}) as SocialLinks,
    themes: row.themes ? mapDbTheme(row.themes) : undefined,
  };
}

// Helper to convert DB row to HomepageSection type
function mapDbSection(row: any): HomepageSection {
  return {
    ...row,
    content: (row.content || {}) as HomepageSectionContent,
    settings: (row.settings || {}) as HomepageSectionSettings,
  };
}

export function useStorefront() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  // Fetch all available themes
  const { data: themes = [], isLoading: themesLoading } = useQuery({
    queryKey: ['themes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('themes')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []).map(mapDbTheme);
    },
  });

  // Fetch tenant's theme settings
  const { data: themeSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['tenant-theme-settings', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('tenant_theme_settings')
        .select(`
          *,
          themes (*)
        `)
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      return data ? mapDbThemeSettings(data) : null;
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch storefront pages
  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ['storefront-pages', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('storefront_pages')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('nav_order');

      if (error) throw error;
      return data as StorefrontPage[];
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch homepage sections
  const { data: sections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ['homepage-sections', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('homepage_sections')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('sort_order');

      if (error) throw error;
      return (data || []).map(mapDbSection);
    },
    enabled: !!currentTenant?.id,
  });

  // Save/Update theme settings
  const saveThemeSettings = useMutation({
    mutationFn: async (settings: Partial<TenantThemeSettings>) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      // Convert to DB-compatible format
      const payload: Record<string, unknown> = {
        tenant_id: currentTenant.id,
        updated_at: new Date().toISOString(),
      };

      // Copy only the fields we want to save, converting social_links to Json
      const allowedFields = [
        'theme_id', 'use_custom_frontend', 'custom_frontend_url',
        'logo_url', 'favicon_url', 'primary_color', 'secondary_color',
        'accent_color', 'background_color', 'text_color', 'heading_font',
        'body_font', 'header_style', 'show_announcement_bar', 'announcement_text',
        'announcement_link', 'show_breadcrumbs', 'show_wishlist', 'product_card_style',
        'products_per_row', 'footer_text', 'custom_css', 'custom_head_scripts',
        'is_published', 'published_at',
        // Newsletter settings
        'newsletter_enabled', 'newsletter_provider', 'newsletter_popup_enabled',
        'newsletter_popup_delay_seconds', 'newsletter_incentive_text',
        // Checkout settings
        'checkout_guest_enabled', 'checkout_phone_required', 'checkout_company_field',
        'checkout_address_autocomplete',
        // Product display settings
        'product_image_zoom', 'product_variant_style', 'product_reviews_display',
        'product_stock_indicator', 'product_related_mode',
        // Trust settings
        'cookie_banner_enabled', 'cookie_banner_style', 'trust_badges',
        // Navigation settings
        'nav_style', 'header_sticky', 'search_display', 'mobile_bottom_nav',
        // Conversion settings
        'show_stock_count', 'show_viewers_count', 'show_recent_purchases', 'exit_intent_popup',
        // Multilingual settings
        'storefront_multilingual_enabled', 'storefront_languages', 'storefront_default_language',
        'storefront_language_selector_style',
        // Intelligent palette
        'brand_color', 'theme_mode', 'theme_style',
      ];

      for (const key of allowedFields) {
        if (key in settings) {
          payload[key] = (settings as any)[key];
        }
      }

      // Handle social_links separately as Json
      if ('social_links' in settings) {
        payload.social_links = settings.social_links as unknown as Json;
      }

      // Check if settings exist
      const { data: existing } = await supabase
        .from('tenant_theme_settings')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('tenant_theme_settings')
          .update(payload as any)
          .eq('tenant_id', currentTenant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_theme_settings')
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-theme-settings', currentTenant?.id] });
      toast.success('Instellingen opgeslagen');
    },
    onError: (error) => {
      console.error('Save settings error:', error);
      toast.error('Fout bij opslaan instellingen');
    },
  });

  // Publish storefront
  const publishStorefront = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const { error } = await supabase
        .from('tenant_theme_settings')
        .update({
          is_published: true,
          published_at: new Date().toISOString(),
        })
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-theme-settings', currentTenant?.id] });
      toast.success('Webshop gepubliceerd!');
    },
    onError: () => {
      toast.error('Fout bij publiceren');
    },
  });

  // CRUD for storefront pages
  const createPage = useMutation({
    mutationFn: async (page: Omit<StorefrontPage, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const { error } = await supabase
        .from('storefront_pages')
        .insert({
          ...page,
          tenant_id: currentTenant.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefront-pages', currentTenant?.id] });
      toast.success('Pagina aangemaakt');
    },
    onError: () => {
      toast.error('Fout bij aanmaken pagina');
    },
  });

  const updatePage = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StorefrontPage> & { id: string }) => {
      const { error } = await supabase
        .from('storefront_pages')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefront-pages', currentTenant?.id] });
      toast.success('Pagina bijgewerkt');
    },
    onError: () => {
      toast.error('Fout bij bijwerken pagina');
    },
  });

  const deletePage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('storefront_pages')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefront-pages', currentTenant?.id] });
      toast.success('Pagina verwijderd');
    },
    onError: () => {
      toast.error('Fout bij verwijderen pagina');
    },
  });

  // CRUD for homepage sections
  const createSection = useMutation({
    mutationFn: async (section: Omit<HomepageSection, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      // Get max sort order
      const maxOrder = sections.reduce((max, s) => Math.max(max, s.sort_order), -1);

      const payload = {
        section_type: section.section_type,
        title: section.title,
        subtitle: section.subtitle,
        content: section.content as unknown as Json,
        settings: section.settings as unknown as Json,
        sort_order: section.sort_order ?? maxOrder + 1,
        is_visible: section.is_visible,
        tenant_id: currentTenant.id,
      };

      const { error } = await supabase
        .from('homepage_sections')
        .insert(payload);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage-sections', currentTenant?.id] });
      toast.success('Sectie toegevoegd');
    },
    onError: () => {
      toast.error('Fout bij toevoegen sectie');
    },
  });

  const updateSection = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<HomepageSection> & { id: string }) => {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if ('section_type' in updates) payload.section_type = updates.section_type;
      if ('title' in updates) payload.title = updates.title;
      if ('subtitle' in updates) payload.subtitle = updates.subtitle;
      if ('content' in updates) payload.content = updates.content as unknown as Json;
      if ('settings' in updates) payload.settings = updates.settings as unknown as Json;
      if ('sort_order' in updates) payload.sort_order = updates.sort_order;
      if ('is_visible' in updates) payload.is_visible = updates.is_visible;

      const { error } = await supabase
        .from('homepage_sections')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage-sections', currentTenant?.id] });
      toast.success('Sectie bijgewerkt');
    },
    onError: () => {
      toast.error('Fout bij bijwerken sectie');
    },
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('homepage_sections')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage-sections', currentTenant?.id] });
      toast.success('Sectie verwijderd');
    },
    onError: () => {
      toast.error('Fout bij verwijderen sectie');
    },
  });

  const reorderSections = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => ({
        id,
        sort_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('homepage_sections')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage-sections', currentTenant?.id] });
    },
    onError: () => {
      toast.error('Fout bij herschikken secties');
    },
  });

  // Get merged theme settings (theme defaults + tenant overrides)
  const getMergedSettings = (): ThemeSettings | null => {
    if (!themeSettings?.themes) return null;

    const defaults = themeSettings.themes.default_settings as ThemeSettings;
    
    return {
      header_style: (themeSettings.header_style || defaults.header_style) as ThemeSettings['header_style'],
      product_card_style: (themeSettings.product_card_style || defaults.product_card_style) as ThemeSettings['product_card_style'],
      products_per_row: themeSettings.products_per_row ?? defaults.products_per_row,
      show_breadcrumbs: themeSettings.show_breadcrumbs ?? defaults.show_breadcrumbs,
      show_wishlist: themeSettings.show_wishlist ?? defaults.show_wishlist,
      primary_color: themeSettings.primary_color || defaults.primary_color,
      secondary_color: themeSettings.secondary_color || defaults.secondary_color,
      accent_color: themeSettings.accent_color || defaults.accent_color,
      background_color: themeSettings.background_color || defaults.background_color,
      text_color: themeSettings.text_color || defaults.text_color,
      heading_font: themeSettings.heading_font || defaults.heading_font,
      body_font: themeSettings.body_font || defaults.body_font,
    };
  };

  return {
    // Data
    themes,
    themeSettings,
    pages,
    sections,
    mergedSettings: getMergedSettings(),
    
    // Loading states
    isLoading: themesLoading || settingsLoading || pagesLoading || sectionsLoading,
    themesLoading,
    settingsLoading,
    pagesLoading,
    sectionsLoading,
    
    // Theme settings mutations
    saveThemeSettings,
    publishStorefront,
    
    // Page mutations
    createPage,
    updatePage,
    deletePage,
    
    // Section mutations
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
  };
}
