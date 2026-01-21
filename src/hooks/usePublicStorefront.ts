import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { 
  TenantThemeSettings, 
  HomepageSection, 
  StorefrontPage,
  HomepageSectionContent,
  HomepageSectionSettings 
} from '@/types/storefront';

interface PublicTenant {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  currency: string;
  country: string;
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

export function usePublicStorefront(tenantSlug: string) {
  // Fetch tenant by slug
  const { data: tenant, isLoading: tenantLoading, error: tenantError } = useQuery({
    queryKey: ['public-tenant', tenantSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, slug, name, logo_url, primary_color, secondary_color, currency, country')
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

  return {
    tenant,
    themeSettings,
    homepageSections,
    navPages,
    categories,
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
