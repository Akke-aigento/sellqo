import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { 
  TenantThemeSettings, 
  HomepageSection, 
  StorefrontPage,
  HomepageSectionContent,
  HomepageSectionSettings 
} from '@/types/storefront';
import type { TranslationLanguage } from '@/types/translation';

interface PublicTenant {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  currency: string;
  country: string;
  iban: string | null;
  bic: string | null;
  payment_methods_enabled: string[] | null;
  pass_transaction_fee_to_customer: boolean | null;
  transaction_fee_label: string | null;
}

interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  images: string[];
  in_stock: boolean;
  category: { id: string; name: string; slug: string } | null;
}

interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
}

interface PublicLegalPage {
  id: string;
  page_type: string;
  title_nl: string;
}

export function usePublicStorefront(tenantSlug: string) {
  // Fetch tenant by slug
  const { data: tenant, isLoading: tenantLoading, error: tenantError } = useQuery({
    queryKey: ['public-tenant', tenantSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, slug, name, logo_url, primary_color, secondary_color, currency, country, iban, bic, payment_methods_enabled, pass_transaction_fee_to_customer, transaction_fee_label')
        .eq('slug', tenantSlug)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error('Shop not found');
      return data as PublicTenant;
    },
    enabled: !!tenantSlug,
  });

  const tenantId = tenant?.id;

  // Fetch theme settings
  const { data: themeSettings, isLoading: themeLoading } = useQuery({
    queryKey: ['public-theme-settings', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_theme_settings')
        .select(`
          *,
          themes (*)
        `)
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;

      // Parse JSON fields and cast
      return {
        ...data,
        social_links: typeof data.social_links === 'string' 
          ? JSON.parse(data.social_links) 
          : data.social_links || {},
      } as unknown as TenantThemeSettings;
    },
    enabled: !!tenantId,
  });

  // Fetch homepage sections
  const { data: homepageSections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ['public-homepage-sections', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homepage_sections')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('is_visible', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      
      return (data || []).map(section => ({
        ...section,
        content: (typeof section.content === 'string' 
          ? JSON.parse(section.content) 
          : section.content || {}) as HomepageSectionContent,
        settings: (typeof section.settings === 'string' 
          ? JSON.parse(section.settings) 
          : section.settings || {}) as HomepageSectionSettings,
      })) as HomepageSection[];
    },
    enabled: !!tenantId,
  });

  // Fetch navigation pages
  const { data: navPages = [] } = useQuery({
    queryKey: ['public-nav-pages', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('storefront_pages')
        .select('id, slug, title, nav_order')
        .eq('tenant_id', tenantId!)
        .eq('is_published', true)
        .eq('show_in_nav', true)
        .order('nav_order', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['public-categories', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, description, image_url, parent_id')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .eq('hide_from_storefront', false)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as PublicCategory[];
    },
    enabled: !!tenantId,
  });

  // Fetch published legal pages
  const { data: legalPages = [] } = useQuery({
    queryKey: ['public-legal-pages', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legal_pages')
        .select('id, page_type, title_nl')
        .eq('tenant_id', tenantId!)
        .eq('is_published', true);
      
      if (error) throw error;
      return (data || []) as PublicLegalPage[];
    },
    enabled: !!tenantId,
  });

  return {
    tenant,
    themeSettings,
    homepageSections,
    navPages,
    categories,
    legalPages,
    isLoading: tenantLoading || themeLoading || sectionsLoading,
    error: tenantError,
  };
}

export function usePublicProducts(tenantId: string | undefined, options?: {
  categoryId?: string;
  search?: string;
  limit?: number;
  productIds?: string[];
}) {
  return useQuery({
    queryKey: ['public-products', tenantId, options],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          id, name, slug, description, price, compare_at_price, images, 
          track_inventory, stock, category_id, 
          categories(id, name, slug)
        `)
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .eq('hide_from_storefront', false);

      if (options?.categoryId) {
        query = query.eq('category_id', options.categoryId);
      }
      if (options?.search) {
        query = query.ilike('name', `%${options.search}%`);
      }
      if (options?.productIds && options.productIds.length > 0) {
        query = query.in('id', options.productIds);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      return (data || []).map(product => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        compare_at_price: product.compare_at_price,
        images: product.images || [],
        in_stock: !product.track_inventory || (product.stock || 0) > 0,
        category: product.categories ? {
          id: product.categories.id,
          name: product.categories.name,
          slug: product.categories.slug,
        } : null,
      })) as PublicProduct[];
    },
    enabled: !!tenantId,
  });
}

export function usePublicProduct(tenantId: string | undefined, productSlug: string) {
  return useQuery({
    queryKey: ['public-product', tenantId, productSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, slug, description, price, compare_at_price, images, 
          track_inventory, stock, sku, weight,
          category_id, categories(id, name, slug),
          meta_title, meta_description
        `)
        .eq('tenant_id', tenantId!)
        .eq('slug', productSlug)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Product not found');

      const product = data as any;
      return {
        ...product,
        images: product.images || [],
        in_stock: !product.track_inventory || (product.stock || 0) > 0,
        category: product.categories ? {
          id: product.categories.id,
          name: product.categories.name,
          slug: product.categories.slug,
        } : null,
      };
    },
    enabled: !!tenantId && !!productSlug,
  });
}

export function usePublicPage(tenantId: string | undefined, pageSlug: string) {
  return useQuery({
    queryKey: ['public-page', tenantId, pageSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('storefront_pages')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('slug', pageSlug)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Page not found');
      return data as StorefrontPage;
    },
    enabled: !!tenantId && !!pageSlug,
  });
}

// Domain-aware storefront lookup
interface DomainInfo {
  tenantId: string;
  tenantSlug: string;
  locale: string;
  isCanonical: boolean;
  domain: string;
}

export function usePublicStorefrontByDomain(hostname: string) {
  const { data: domainInfo, isLoading: domainLoading, error: domainError } = useQuery({
    queryKey: ['public-domain-lookup', hostname],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_domains')
        .select('id, tenant_id, domain, locale, is_canonical')
        .eq('domain', hostname)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Get tenant slug
      const { data: tenant } = await supabase
        .from('tenants')
        .select('slug')
        .eq('id', data.tenant_id)
        .single();

      return {
        tenantId: data.tenant_id,
        tenantSlug: tenant?.slug || '',
        locale: data.locale,
        isCanonical: data.is_canonical,
        domain: data.domain,
      } as DomainInfo;
    },
    enabled: !!hostname,
  });

  return { domainInfo, domainLoading, domainError };
}

// Fetch all domains for a tenant (for hreflang tags)
export function useTenantPublicDomains(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['public-tenant-domains', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_domains')
        .select('domain, locale, is_canonical')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });
}

// Get translated product content for a specific locale
export function useLocalizedProduct(
  tenantId: string | undefined,
  productId: string | undefined,
  locale: string,
  defaultLocale: string = 'nl'
) {
  return useQuery({
    queryKey: ['localized-product', tenantId, productId, locale],
    queryFn: async () => {
      if (locale === defaultLocale) return null;

      const { data, error } = await supabase
        .from('content_translations')
        .select('field_name, translated_content')
        .eq('tenant_id', tenantId!)
        .eq('entity_type', 'product')
        .eq('entity_id', productId!)
        .eq('target_language', locale);

      if (error) throw error;

      const fieldMap: Record<string, string | null> = {};
      for (const t of data || []) {
        if (t.translated_content) {
          fieldMap[t.field_name] = t.translated_content;
        }
      }
      return fieldMap;
    },
    enabled: !!tenantId && !!productId && locale !== defaultLocale,
  });
}

// Generate hreflang and canonical meta for SEO
export function generateDomainSEOMeta(
  domains: Array<{ domain: string; locale: string; is_canonical: boolean }>,
  currentPath: string = '/'
) {
  const canonical = domains.find(d => d.is_canonical);
  const hreflangs = domains.map(d => ({
    hreflang: d.locale,
    href: `https://${d.domain}${currentPath}`,
  }));

  if (canonical) {
    hreflangs.push({
      hreflang: 'x-default',
      href: `https://${canonical.domain}${currentPath}`,
    });
  }

  return {
    canonicalUrl: canonical ? `https://${canonical.domain}${currentPath}` : null,
    hreflangs,
  };
}
