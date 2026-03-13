import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?bundle";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tenant-id, x-api-key, accept-language, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

// ============== TYPES ==============

interface StorefrontRequest {
  action: string;
  tenant_id?: string;
  params?: Record<string, unknown>;
}

interface ServicePoint {
  id: string; name: string; carrier: string; type: string;
  address: { street: string; house_number?: string; city: string; postal_code: string; country: string; };
  distance?: number; latitude?: number; longitude?: number; opening_hours?: Record<string, string>;
}

interface CartItem {
  product_id: string; product_name: string; sku?: string; price: number; quantity: number;
  category_id?: string | null; image_url?: string | null;
}

interface AppliedDiscount { type: string; name: string; value: number; source_id: string; description?: string; }

interface CartGift {
  product_id: string; product_name: string; quantity: number;
  promotion_id: string; promotion_name: string; product_image?: string | null;
}

// ============== PROMOTION UTILS ==============

function isPromotionActive(isActive: boolean, validFrom: string | null, validUntil: string | null): boolean {
  if (!isActive) return false;
  const now = new Date();
  if (validFrom && now < new Date(validFrom)) return false;
  if (validUntil && now > new Date(validUntil)) return false;
  return true;
}

function checkSchedule(schedule: { days?: number[]; start_time?: string; end_time?: string } | null): boolean {
  if (!schedule) return true;
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  if (schedule.days?.length && !schedule.days.includes(currentDay)) return false;
  if (schedule.start_time && currentTime < schedule.start_time) return false;
  if (schedule.end_time && currentTime > schedule.end_time) return false;
  return true;
}

function calculateDiscountValue(originalAmount: number, discountType: string, discountValue: number, maxDiscountAmount?: number | null): number {
  let discount = discountType === 'percentage' ? originalAmount * (discountValue / 100) : discountValue;
  if (maxDiscountAmount && discount > maxDiscountAmount) discount = maxDiscountAmount;
  return Math.min(discount, originalAmount);
}

// ============== TRANSLATION HELPER ==============

async function getTranslations(supabase: any, tenantId: string, entityType: string, entityIds: string[], locale: string): Promise<Record<string, Record<string, string>>> {
  if (!locale || entityIds.length === 0) return {};
  const { data } = await supabase
    .from('content_translations')
    .select('entity_id, field_name, translated_content')
    .eq('tenant_id', tenantId)
    .eq('entity_type', entityType)
    .in('entity_id', entityIds)
    .eq('target_language', locale);
  const map: Record<string, Record<string, string>> = {};
  if (data) {
    for (const t of data) {
      if (!map[t.entity_id]) map[t.entity_id] = {};
      if (t.translated_content) map[t.entity_id][t.field_name] = t.translated_content;
    }
  }
  return map;
}

// ============== RESOLVE DOMAIN ==============

async function resolveDomain(supabase: any, params: Record<string, unknown>) {
  const hostname = (params.hostname as string || '').toLowerCase().trim();
  if (!hostname) throw new Error('hostname is required');

  const { data: domain, error } = await supabase
    .from('tenant_domains')
    .select('id, tenant_id, domain, locale, is_canonical, is_active, dns_verified, ssl_active')
    .eq('domain', hostname).eq('is_active', true).maybeSingle();
  if (error) throw error;
  if (!domain) throw new Error('Domain not found');

  const [{ data: tenant }, { data: themeSettings }, { data: allDomains }] = await Promise.all([
    supabase.from('tenants').select('id, slug, name, store_name').eq('id', domain.tenant_id).single(),
    supabase.from('tenant_theme_settings').select('use_custom_frontend, custom_frontend_url').eq('tenant_id', domain.tenant_id).maybeSingle(),
    supabase.from('tenant_domains').select('domain, locale, is_canonical').eq('tenant_id', domain.tenant_id).eq('is_active', true),
  ]);

  if (!tenant) throw new Error('Tenant not found for domain');

  return {
    tenant_id: tenant.id, tenant_slug: tenant.slug, tenant_name: tenant.store_name || tenant.name,
    locale: domain.locale, is_canonical: domain.is_canonical, dns_verified: domain.dns_verified, ssl_active: domain.ssl_active,
    use_custom_frontend: themeSettings?.use_custom_frontend || false, custom_frontend_url: themeSettings?.custom_frontend_url || null,
    all_domains: (allDomains || []).map((d: any) => ({ domain: d.domain, locale: d.locale, is_canonical: d.is_canonical })),
  };
}

// ============== GET TENANT ==============

async function getTenant(supabase: any, tenantId: string, params: Record<string, unknown> = {}) {
  const locale = params.locale as string | undefined;
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, logo_url, primary_color, currency, country, default_vat_rate, store_name, store_description, contact_email, contact_phone')
    .eq('id', tenantId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Tenant not found');

  let storeName = data.store_name || data.name;
  let storeDescription = data.store_description;

  if (locale) {
    const tMap = await getTranslations(supabase, tenantId, 'tenant', [tenantId], locale);
    const t = tMap[tenantId] || {};
    if (t.store_name) storeName = t.store_name;
    if (t.store_description) storeDescription = t.store_description;
  }

  return {
    id: data.id, slug: data.slug, name: storeName, description: storeDescription,
    logo_url: data.logo_url, primary_color: data.primary_color,
    currency: data.currency || 'EUR', country: data.country || 'NL',
    contact_email: data.contact_email, contact_phone: data.contact_phone,
  };
}

// ============== GET CONFIG ==============

async function getConfig(supabase: any, tenantId: string, params: Record<string, unknown> = {}) {
  const locale = params.locale as string | undefined;

  const [
    { data: tenant },
    { data: themeSettings },
    { data: domains },
    { data: storefrontConfig },
  ] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', tenantId).single(),
    supabase.from('tenant_theme_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('tenant_domains').select('domain, locale, is_canonical, is_active').eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('storefront_config').select('*').eq('tenant_id', tenantId).maybeSingle(),
  ]);

  if (!tenant) throw new Error('Tenant not found');

  let storeName = tenant.store_name || tenant.name;
  let storeDescription = tenant.store_description;
  let announcementText = themeSettings?.announcement_text || null;

  if (locale) {
    const tMap = await getTranslations(supabase, tenantId, 'tenant', [tenantId], locale);
    const t = tMap[tenantId] || {};
    if (t.store_name) storeName = t.store_name;
    if (t.store_description) storeDescription = t.store_description;
    if (t.announcement_text) announcementText = t.announcement_text;
  }

  const activeDomains = (domains || []).filter((d: any) => d.is_active);
  const canonicalDomain = activeDomains.find((d: any) => d.is_canonical);
  const languages = [...new Set(activeDomains.map((d: any) => d.locale).filter(Boolean))];

  return {
    store: {
      name: storeName,
      description: storeDescription,
      logo_url: tenant.logo_url,
      favicon_url: themeSettings?.favicon_url || null,
      primary_color: tenant.primary_color,
      currency: tenant.currency || 'EUR',
      country: tenant.country || 'NL',
      vat_rate: tenant.default_vat_rate || 21,
    },
    contact: {
      email: tenant.contact_email,
      phone: tenant.contact_phone,
      company_name: tenant.company_name || null,
      address: tenant.company_address || null,
      vat_number: tenant.vat_number || null,
      kvk_number: tenant.kvk_number || null,
    },
    social: {
      facebook: tenant.social_facebook || null,
      instagram: tenant.social_instagram || null,
      twitter: tenant.social_twitter || null,
      linkedin: tenant.social_linkedin || null,
      tiktok: tenant.social_tiktok || null,
      youtube: tenant.social_youtube || null,
    },
    languages: {
      available: languages,
      default: tenant.default_language || 'nl',
      domain_mapping: activeDomains.map((d: any) => ({ domain: d.domain, locale: d.locale, is_canonical: d.is_canonical })),
    },
    canonical_domain: canonicalDomain?.domain || null,
    features: {
      reviews_enabled: storefrontConfig?.reviews_enabled ?? true,
      newsletter_enabled: storefrontConfig?.newsletter_enabled ?? false,
      guest_checkout: storefrontConfig?.guest_checkout ?? true,
      search_enabled: true,
      customer_accounts: storefrontConfig?.customer_accounts ?? true,
    },
    payments: {
      stripe_enabled: !!tenant.stripe_account_id && !!tenant.stripe_charges_enabled,
      bank_transfer_enabled: !!tenant.bank_account_iban,
    },
    appearance: {
      announcement_bar: announcementText ? { text: announcementText, enabled: themeSettings?.show_announcement_bar || false } : null,
      nav_style: storefrontConfig?.nav_style || 'simple',
      cookie_banner: storefrontConfig?.cookie_banner_enabled ?? true,
    },
  };
}

// ============== GET CATEGORIES ==============

async function getCategories(supabase: any, tenantId: string, params: Record<string, unknown> = {}) {
  const locale = params.locale as string | undefined;
  const hideEmpty = params.hide_empty === true || params.hide_empty === 'true';

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, name, slug, description, image_url, parent_id, sort_order, is_active, hide_from_storefront')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('hide_from_storefront', false)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  if (!categories || categories.length === 0) return [];

  // Get product counts per category from BOTH legacy category_id AND junction table
  const { data: legacyProducts } = await supabase
    .from('products')
    .select('id, category_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('hide_from_storefront', false);

  const categoryIds = categories.map((c: any) => c.id);
  const { data: junctionRows } = await supabase
    .from('product_categories')
    .select('product_id, category_id')
    .in('category_id', categoryIds);

  const activeProductIds = new Set((legacyProducts || []).map((p: any) => p.id));

  const countMap: Record<string, Set<string>> = {};
  // Legacy category_id
  for (const p of (legacyProducts || [])) {
    if (p.category_id) {
      if (!countMap[p.category_id]) countMap[p.category_id] = new Set();
      countMap[p.category_id].add(p.id);
    }
  }
  // Junction table (only active products)
  for (const row of (junctionRows || [])) {
    if (activeProductIds.has(row.product_id)) {
      if (!countMap[row.category_id]) countMap[row.category_id] = new Set();
      countMap[row.category_id].add(row.product_id);
    }
  }

  // Translations
  const tMap = locale ? await getTranslations(supabase, tenantId, 'category', categories.map((c: any) => c.id), locale) : {};

  const result = categories.map((cat: any) => {
    const t = tMap[cat.id] || {};
    return {
      id: cat.id,
      name: t.name || cat.name,
      slug: cat.slug,
      description: t.description || cat.description,
      image_url: cat.image_url,
      parent_id: cat.parent_id,
      product_count: countMap[cat.id]?.size || 0,
    };
  });

  // Filter out empty categories if requested
  if (hideEmpty) {
    return result.filter((cat: any) => cat.product_count > 0);
  }

  return result;
}

// ============== GET PRODUCT (SINGLE) ==============

async function getProduct(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const slug = params.slug as string;
  const productId = params.product_id as string;
  const locale = params.locale as string | undefined;

  if (!slug && !productId) throw new Error('slug or product_id is required');

  let query = supabase
    .from('products')
    .select('*, categories(id, name, slug)')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (slug) query = query.eq('slug', slug);
  else query = query.eq('id', productId);

  const { data: product, error } = await query.maybeSingle();
  if (error) throw error;
  if (!product) throw new Error('Product not found');

  // Translations
  const tMap = locale ? await getTranslations(supabase, tenantId, 'product', [product.id], locale) : {};
  const t = tMap[product.id] || {};

  // Related products (same category, max 8)
  let relatedProducts: any[] = [];
  if (product.category_id) {
    const { data: related } = await supabase
      .from('products')
      .select('id, name, slug, price, compare_at_price, images')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('hide_from_storefront', false)
      .eq('category_id', product.category_id)
      .neq('id', product.id)
      .limit(8);

    if (related && locale) {
      const relTMap = await getTranslations(supabase, tenantId, 'product', related.map((r: any) => r.id), locale);
      relatedProducts = related.map((r: any) => {
        const rt = relTMap[r.id] || {};
        return { id: r.id, name: rt.name || r.name, slug: r.slug, price: r.price, compare_at_price: r.compare_at_price, image: r.images?.[0] || null };
      });
    } else {
      relatedProducts = (related || []).map((r: any) => ({
        id: r.id, name: r.name, slug: r.slug, price: r.price, compare_at_price: r.compare_at_price, image: r.images?.[0] || null,
      }));
    }
  }

  // Reviews
  const { data: reviews } = await supabase
    .from('external_reviews')
    .select('id, reviewer_name, rating, review_text, created_at, platform')
    .eq('tenant_id', tenantId)
    .eq('product_id', product.id)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(20);

  const avgRating = reviews?.length ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length : null;

  // Determine if this product is a variant-product (has parent_product_id)
  const isVariantProduct = !!product.parent_product_id;
  const parentProductId = isVariantProduct ? product.parent_product_id : product.id;

  // Fetch variants and variant options from the parent product (or self if parent)
  const [{ data: variants }, { data: variantOptions }] = await Promise.all([
    supabase.from('product_variants').select('*').eq('product_id', parentProductId).eq('tenant_id', tenantId).eq('is_active', true).order('position', { ascending: true }),
    supabase.from('product_variant_options').select('*').eq('product_id', parentProductId).eq('tenant_id', tenantId).order('position', { ascending: true }),
  ]);

  const hasVariants = (variants?.length || 0) > 0;

  // For cross-linked variants: fetch linked product slugs
  let linkedProductSlugs: Record<string, string> = {};
  if (hasVariants) {
    const linkedProductIds = (variants || [])
      .filter((v: any) => v.linked_product_id)
      .map((v: any) => v.linked_product_id);
    if (linkedProductIds.length > 0) {
      const { data: linkedProducts } = await supabase
        .from('products')
        .select('id, slug')
        .in('id', linkedProductIds);
      if (linkedProducts) {
        for (const lp of linkedProducts) {
          linkedProductSlugs[lp.id] = lp.slug;
        }
      }
    }
  }

  // Determine which variant matches this product (for variant-products)
  let selectedVariantIndex: number | null = null;
  if (isVariantProduct && variants) {
    selectedVariantIndex = variants.findIndex((v: any) => v.linked_product_id === product.id);
    if (selectedVariantIndex === -1) selectedVariantIndex = null;
  }

  // Determine in_stock: if product-level track_inventory is off, always in stock
  const productTrackInventory = !!product.track_inventory;
  let inStock: boolean;
  if (hasVariants) {
    inStock = (variants || []).some((v: any) => {
      // If product-level tracking is off, variant is always in stock
      if (!productTrackInventory) return true;
      // Otherwise check variant-level tracking
      return !v.track_inventory || v.stock > 0;
    });
  } else {
    inStock = !productTrackInventory || product.stock > 0;
  }

  // Determine product_type
  const productType = product.product_type || 'physical';

  return {
    id: product.id,
    name: t.name || product.name,
    slug: product.slug,
    description: t.description || product.description,
    short_description: t.short_description || product.short_description || null,
    price: product.price,
    compare_at_price: product.compare_at_price,
    images: product.images || [],
    sku: product.sku,
    barcode: product.barcode || null,
    weight: product.weight || null,
    product_type: productType,
    in_stock: inStock,
    stock: productTrackInventory ? product.stock : null,
    tags: product.tags || [],
    category: product.categories ? { id: product.categories.id, name: product.categories.name, slug: product.categories.slug } : null,
    has_variants: hasVariants,
    is_variant_product: isVariantProduct,
    parent_product_id: isVariantProduct ? product.parent_product_id : null,
    selected_variant_index: selectedVariantIndex,
    variants: (variants || []).map((v: any) => ({
      id: v.id, title: v.title, sku: v.sku, barcode: v.barcode,
      price: v.price ?? product.price, compare_at_price: v.compare_at_price ?? product.compare_at_price,
      stock: (productTrackInventory && v.track_inventory) ? v.stock : null,
      in_stock: !productTrackInventory || !v.track_inventory || v.stock > 0,
      image_url: v.image_url, attribute_values: v.attribute_values, weight: v.weight ?? product.weight,
      linked_product_id: v.linked_product_id || null,
      linked_product_slug: v.linked_product_id ? (linkedProductSlugs[v.linked_product_id] || null) : null,
    })),
    options: (variantOptions || []).map((o: any) => ({ id: o.id, name: o.name, values: o.values, position: o.position })),
    seo: {
      meta_title: t.meta_title || product.meta_title || product.name,
      meta_description: t.meta_description || product.meta_description || product.description?.substring(0, 160) || '',
    },
    related_products: relatedProducts,
    reviews: {
      items: reviews || [],
      average_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      total_count: reviews?.length || 0,
    },
  };
}

// ============== GET PRODUCTS (EXTENDED) ==============

async function getProducts(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const locale = params?.locale as string | undefined;
  const page = Math.max(1, Number(params?.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(params?.per_page) || 24));
  const sortBy = (params?.sort_by as string) || 'newest';
  const categoryId = params?.category_id as string | undefined;
  const categorySlug = params?.category_slug as string | undefined;
  const search = params?.search as string | undefined;
  const minPrice = params?.min_price != null ? Number(params.min_price) : undefined;
  const maxPrice = params?.max_price != null ? Number(params.max_price) : undefined;
  const tags = params?.tags as string[] | undefined;
  const inStockOnly = params?.in_stock_only === true;
  const isFeatured = params?.is_featured === true;

  // Resolve category slug to id
  let resolvedCategoryId = categoryId;
  if (!resolvedCategoryId && categorySlug) {
    const { data: cat } = await supabase
      .from('categories').select('id').eq('tenant_id', tenantId).eq('slug', categorySlug).maybeSingle();
    resolvedCategoryId = cat?.id;
  }

  let query = supabase
    .from('products')
    .select('id, name, slug, description, price, compare_at_price, images, is_active, hide_from_storefront, track_inventory, stock, sku, category_id, tags, is_featured, created_at, product_type, categories(id, name, slug, hide_from_storefront)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('hide_from_storefront', false);

  if (resolvedCategoryId) {
    // Query junction table for multi-category support
    const { data: pcRows } = await supabase
      .from('product_categories')
      .select('product_id')
      .eq('category_id', resolvedCategoryId);
    const junctionIds = (pcRows || []).map((r: any) => r.product_id);
    if (junctionIds.length > 0) {
      query = query.or(`category_id.eq.${resolvedCategoryId},id.in.(${junctionIds.join(',')})`);
    } else {
      query = query.eq('category_id', resolvedCategoryId);
    }
  }
  if (search) query = query.ilike('name', `%${search}%`);
  if (minPrice != null) query = query.gte('price', minPrice);
  if (maxPrice != null) query = query.lte('price', maxPrice);
  if (isFeatured) query = query.eq('is_featured', true);
  if (tags?.length) query = query.overlaps('tags', tags);

  // Sorting
  switch (sortBy) {
    case 'price_asc': query = query.order('price', { ascending: true }); break;
    case 'price_desc': query = query.order('price', { ascending: false }); break;
    case 'name_asc': query = query.order('name', { ascending: true }); break;
    case 'name_desc': query = query.order('name', { ascending: false }); break;
    case 'featured': query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false }); break;
    case 'newest': default: query = query.order('created_at', { ascending: false }); break;
  }

  // Pagination
  const from = (page - 1) * perPage;
  query = query.range(from, from + perPage - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  // Filter hidden categories
  const visible = (data || []).filter((p: any) => !(p.categories && p.categories.hide_from_storefront));

  // Filter in-stock
  const filtered = inStockOnly ? visible.filter((p: any) => !p.track_inventory || p.stock > 0) : visible;

  // Translations
  const tMap = locale && filtered.length > 0
    ? await getTranslations(supabase, tenantId, 'product', filtered.map((p: any) => p.id), locale) : {};

  const totalCount = count || 0;

  // Fetch variant data for all products
  const productIds = filtered.map((p: any) => p.id);
  let variantMap: Record<string, any[]> = {};
  if (productIds.length > 0) {
    const { data: allVariants } = await supabase
      .from('product_variants').select('product_id, price, stock, track_inventory, is_active')
      .in('product_id', productIds).eq('is_active', true);
    if (allVariants) {
      for (const v of allVariants) {
        if (!variantMap[v.product_id]) variantMap[v.product_id] = [];
        variantMap[v.product_id].push(v);
      }
    }
  }

  return {
    products: filtered.map((product: any) => {
      const t = tMap[product.id] || {};
      const pVariants = variantMap[product.id] || [];
      const hasVariants = pVariants.length > 0;
      let priceRange = null;
      if (hasVariants) {
        const prices = pVariants.map((v: any) => v.price ?? product.price);
        priceRange = { min: Math.min(...prices), max: Math.max(...prices) };
      }
      const productTrackInventory = !!product.track_inventory;
      const productType = product.product_type || 'physical';
      let inStock: boolean;
      if (hasVariants) {
        inStock = pVariants.some((v: any) => {
          if (!productTrackInventory) return true;
          return !v.track_inventory || v.stock > 0;
        });
      } else {
        inStock = !productTrackInventory || product.stock > 0;
      }
      return {
        id: product.id, name: t.name || product.name, slug: product.slug,
        description: t.description || product.description,
        price: product.price, compare_at_price: product.compare_at_price,
        images: product.images || [],
        product_type: productType,
        in_stock: inStock,
        stock: productTrackInventory ? product.stock : null, sku: product.sku,
        tags: product.tags || [], is_featured: product.is_featured || false,
        category: product.categories ? { id: product.categories.id, name: product.categories.name, slug: product.categories.slug } : null,
        has_variants: hasVariants,
        price_range: priceRange,
      };
    }),
    pagination: {
      page, per_page: perPage, total_count: totalCount, total_pages: Math.ceil(totalCount / perPage),
    },
  };
}

// ============== GET PAGES ==============

async function getPages(supabase: any, tenantId: string, params: Record<string, unknown> = {}) {
  const locale = params.locale as string | undefined;
  const slug = params.slug as string | undefined;

  if (slug) {
    const { data: page, error } = await supabase
      .from('pages')
      .select('id, title, slug, content, meta_title, meta_description, show_in_nav, nav_order, is_published')
      .eq('tenant_id', tenantId).eq('slug', slug).eq('is_published', true).maybeSingle();
    if (error) throw error;
    if (!page) throw new Error('Page not found');

    const tMap = locale ? await getTranslations(supabase, tenantId, 'page', [page.id], locale) : {};
    const t = tMap[page.id] || {};
    return {
      id: page.id, title: t.title || page.title, slug: page.slug,
      content: t.content || page.content,
      meta_title: t.meta_title || page.meta_title, meta_description: t.meta_description || page.meta_description,
    };
  }

  // List all published pages
  const { data: pages, error } = await supabase
    .from('pages')
    .select('id, title, slug, show_in_nav, nav_order, is_published')
    .eq('tenant_id', tenantId).eq('is_published', true)
    .order('nav_order', { ascending: true });
  if (error) throw error;

  const tMap = locale && pages?.length ? await getTranslations(supabase, tenantId, 'page', pages.map((p: any) => p.id), locale) : {};
  return (pages || []).map((page: any) => {
    const t = tMap[page.id] || {};
    return { id: page.id, title: t.title || page.title, slug: page.slug, show_in_nav: page.show_in_nav, nav_order: page.nav_order };
  });
}

// ============== GET HOMEPAGE ==============

async function getHomepage(supabase: any, tenantId: string) {
  const { data, error } = await supabase
    .from('homepage_sections')
    .select('id, section_type, title, content, settings, sort_order, is_visible')
    .eq('tenant_id', tenantId).eq('is_visible', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ============== GET REVIEWS ==============

async function getReviews(supabase: any, tenantId: string, params: Record<string, unknown> = {}) {
  const productId = params.product_id as string | undefined;
  const limit = Math.min(50, Number(params.limit) || 20);
  const featuredOnly = params.featured_only === true;

  let query = supabase
    .from('external_reviews')
    .select('id, reviewer_name, rating, review_text, created_at, platform, is_featured, product_id')
    .eq('tenant_id', tenantId).eq('is_visible', true);

  if (productId) query = query.eq('product_id', productId);
  if (featuredOnly) query = query.eq('is_featured', true);

  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;

  const reviews = data || [];
  const avgRating = reviews.length ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length : null;
  return { reviews, average_rating: avgRating ? Math.round(avgRating * 10) / 10 : null, total_count: reviews.length };
}

// ============== SEARCH PRODUCTS ==============

async function searchProducts(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const query = (params.query as string || '').trim();
  const autocomplete = params.autocomplete === true;
  const limit = Math.min(50, Number(params.limit) || 20);
  const locale = params.locale as string | undefined;

  if (!query || query.length < 2) return { results: [] };

  // Search across name, description, sku, tags
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, price, compare_at_price, images, sku, tags, description')
    .eq('tenant_id', tenantId).eq('is_active', true).eq('hide_from_storefront', false)
    .or(`name.ilike.%${query}%,description.ilike.%${query}%,sku.ilike.%${query}%`)
    .limit(limit);

  if (error) throw error;
  if (!data) return { results: [] };

  // Sort: exact name match first, then name contains, then description
  const lq = query.toLowerCase();
  const sorted = data.sort((a: any, b: any) => {
    const aExact = a.name.toLowerCase() === lq ? 0 : a.name.toLowerCase().includes(lq) ? 1 : 2;
    const bExact = b.name.toLowerCase() === lq ? 0 : b.name.toLowerCase().includes(lq) ? 1 : 2;
    return aExact - bExact;
  });

  if (autocomplete) {
    return { results: sorted.map((p: any) => ({ id: p.id, name: p.name, slug: p.slug, image: p.images?.[0] || null, price: p.price })) };
  }

  const tMap = locale ? await getTranslations(supabase, tenantId, 'product', sorted.map((p: any) => p.id), locale) : {};
  return {
    results: sorted.map((p: any) => {
      const t = tMap[p.id] || {};
      return {
        id: p.id, name: t.name || p.name, slug: p.slug, price: p.price, compare_at_price: p.compare_at_price,
        image: p.images?.[0] || null, sku: p.sku,
      };
    }),
  };
}

// ============== GET SEO ==============

async function getSeo(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const entityType = params.type as string; // 'product', 'category', 'page'
  const slug = params.slug as string;
  const locale = params.locale as string | undefined;

  if (!entityType || !slug) throw new Error('type and slug are required');

  const tableMap: Record<string, string> = { product: 'products', category: 'categories', page: 'pages' };
  const table = tableMap[entityType];
  if (!table) throw new Error('Invalid type');

  const { data, error } = await supabase
    .from(table)
    .select('id, name, slug, meta_title, meta_description')
    .eq('tenant_id', tenantId).eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`${entityType} not found`);

  // Get hreflang domains
  const { data: domains } = await supabase
    .from('tenant_domains').select('domain, locale, is_canonical')
    .eq('tenant_id', tenantId).eq('is_active', true);

  const tMap = locale ? await getTranslations(supabase, tenantId, entityType, [data.id], locale) : {};
  const t = tMap[data.id] || {};

  const canonical = (domains || []).find((d: any) => d.is_canonical);
  const hreflangs = (domains || []).map((d: any) => ({
    locale: d.locale, url: `https://${d.domain}/${entityType === 'product' ? 'products' : entityType === 'category' ? 'categories' : ''}/${slug}`,
  }));

  return {
    meta_title: t.meta_title || data.meta_title || data.name || data.title,
    meta_description: t.meta_description || data.meta_description || '',
    canonical_url: canonical ? `https://${canonical.domain}/${entityType === 'product' ? 'products' : entityType === 'category' ? 'categories' : ''}/${slug}` : null,
    hreflang: hreflangs,
    og: {
      title: t.meta_title || data.meta_title || data.name || data.title,
      description: t.meta_description || data.meta_description || '',
      type: entityType === 'product' ? 'product' : 'website',
    },
  };
}

// ============== GET SITEMAP DATA ==============

async function getSitemapData(supabase: any, tenantId: string) {
  const [{ data: products }, { data: categories }, { data: pages }, { data: domains }] = await Promise.all([
    supabase.from('products').select('slug, updated_at').eq('tenant_id', tenantId).eq('is_active', true).eq('hide_from_storefront', false),
    supabase.from('categories').select('slug, updated_at').eq('tenant_id', tenantId).eq('is_active', true).eq('hide_from_storefront', false),
    supabase.from('pages').select('slug, updated_at').eq('tenant_id', tenantId).eq('is_published', true),
    supabase.from('tenant_domains').select('domain, locale, is_canonical').eq('tenant_id', tenantId).eq('is_active', true),
  ]);

  const canonical = (domains || []).find((d: any) => d.is_canonical);
  const baseUrl = canonical ? `https://${canonical.domain}` : null;

  return {
    base_url: baseUrl,
    products: (products || []).map((p: any) => ({ slug: p.slug, updated_at: p.updated_at })),
    categories: (categories || []).map((c: any) => ({ slug: c.slug, updated_at: c.updated_at })),
    pages: (pages || []).map((p: any) => ({ slug: p.slug, updated_at: p.updated_at })),
    domains: domains || [],
  };
}

// ============== SHIPPING METHODS ==============

async function getShippingMethods(supabase: any, tenantId: string) {
  const { data, error } = await supabase
    .from('shipping_methods')
    .select('id, name, description, price, free_above, estimated_days_min, estimated_days_max, is_default')
    .eq('tenant_id', tenantId).eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map((m: any) => ({
    id: m.id, name: m.name, description: m.description, price: m.price, free_above: m.free_above,
    estimated_days: m.estimated_days_min && m.estimated_days_max ? `${m.estimated_days_min}-${m.estimated_days_max}` : m.estimated_days_min || m.estimated_days_max || null,
    is_default: m.is_default,
  }));
}

// ============== SERVICE POINTS ==============

async function getServicePoints(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const { postal_code, country, carrier, house_number } = params as { postal_code: string; country: string; carrier?: string; house_number?: string; };
  if (!postal_code || !country) throw new Error('postal_code and country are required');

  const { data: integration } = await supabase
    .from('shipping_integrations').select('*')
    .eq('tenant_id', tenantId).eq('is_active', true)
    .order('is_default', { ascending: false }).limit(1).maybeSingle();
  if (!integration) return { provider: 'none', service_points: [] };

  const credentials = integration.credentials || {};
  let servicePoints: ServicePoint[] = [];

  if (integration.provider === 'sendcloud') {
    const apiKey = credentials.api_key; const apiSecret = credentials.api_secret;
    if (!apiKey || !apiSecret) throw new Error('Sendcloud credentials not configured');
    let url = `https://servicepoints.sendcloud.sc/api/v2/service-points?country=${country}&postal_code=${postal_code}`;
    if (carrier) url += `&carrier=${carrier}`;
    if (house_number) url += `&house_number=${house_number}`;
    const response = await fetch(url, { headers: { 'Authorization': `Basic ${btoa(`${apiKey}:${apiSecret}`)}`, 'Content-Type': 'application/json' } });
    if (!response.ok) throw new Error(`Sendcloud API error: ${response.status}`);
    const data = await response.json();
    servicePoints = (data || []).map((p: any) => ({
      id: String(p.id), name: p.name, carrier: p.carrier, type: p.is_locker ? 'locker' : 'pickup_point',
      address: { street: p.street, house_number: p.house_number, city: p.city, postal_code: p.postal_code, country: p.country },
      distance: p.distance, latitude: p.latitude, longitude: p.longitude, opening_hours: p.formatted_opening_times || {},
    }));
  } else if (integration.provider === 'myparcel') {
    const apiKey = credentials.api_key;
    if (!apiKey) throw new Error('MyParcel API key not configured');
    const carrierMap: Record<string, string> = { postnl: 'postnl', dhl: 'dhlforyou', dpd: 'dpd' };
    const mc = carrier ? carrierMap[carrier.toLowerCase()] || carrier : 'postnl';
    const response = await fetch(`https://api.myparcel.nl/pickup_locations?cc=${country}&postal_code=${postal_code}&carrier=${mc}`, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
    if (!response.ok) throw new Error(`MyParcel API error: ${response.status}`);
    const data = await response.json();
    servicePoints = (data.data?.pickup_locations || []).map((p: any) => ({
      id: p.location_code || String(p.location_id), name: p.location_name || p.retail_network_id, carrier: p.carrier?.human || carrier || 'postnl',
      type: p.is_locker ? 'locker' : 'pickup_point',
      address: { street: p.street, house_number: p.number, city: p.city, postal_code: p.postal_code, country: p.cc },
      distance: p.distance, latitude: p.latitude, longitude: p.longitude, opening_hours: formatMyParcelOpeningHours(p.opening_hours),
    }));
  }
  return { provider: integration.provider, service_points: servicePoints };
}

function formatMyParcelOpeningHours(hours: any[]): Record<string, string> {
  if (!hours || !Array.isArray(hours)) return {};
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const result: Record<string, string> = {};
  hours.forEach((day: any, i: number) => { if (day?.length > 0) result[days[i]] = day.map((s: any) => `${s.start}-${s.end}`).join(', '); });
  return result;
}

// ============== PROMOTION CALCULATION ==============

async function calculatePromotions(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const { items, customer_id, discount_code, loyalty_points_to_redeem = 0 } = params as {
    items: CartItem[]; customer_id?: string; discount_code?: string; loyalty_points_to_redeem?: number;
  };

  if (!items || items.length === 0) return { original_subtotal: 0, discounted_subtotal: 0, total_discount: 0, applied_discounts: [], gifts: [], free_shipping: false };

  const originalSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartProductIds = items.map(i => i.product_id);
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

  const [
    { data: volumeDiscounts }, { data: bogoPromotions }, { data: bundles }, { data: autoDiscounts },
    { data: giftPromotions }, { data: stackingRules }, discountCodeData, customerGroupData,
  ] = await Promise.all([
    supabase.from('volume_discounts').select('*, volume_discount_tiers(*)').eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('bogo_promotions').select('*').eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('product_bundles').select('*, bundle_products(*, products(id, name, price, image_url))').eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('automatic_discounts').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('priority', { ascending: true }),
    supabase.from('gift_promotions').select('*, gift_product:products!gift_promotions_gift_product_id_fkey(id, name, price, image_url)').eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('discount_stacking_rules').select('*').eq('tenant_id', tenantId).eq('is_active', true),
    discount_code ? supabase.from('discount_codes').select('*').eq('tenant_id', tenantId).eq('code', discount_code).eq('is_active', true).maybeSingle() : { data: null },
    customer_id ? supabase.from('customer_group_members').select('customer_groups(*)').eq('customer_id', customer_id) : { data: [] },
  ]);

  const allDiscounts: AppliedDiscount[] = [];
  const gifts: CartGift[] = [];
  let freeShipping = false;
  let freeShippingReason: string | undefined;

  // 1. VOLUME DISCOUNTS
  for (const vd of volumeDiscounts || []) {
    if (!isPromotionActive(true, vd.valid_from, vd.valid_until)) continue;
    const eligibleItems = items.filter(item => {
      if (vd.applies_to === 'all') return true;
      if (vd.applies_to === 'product' && vd.product_ids?.includes(item.product_id)) return true;
      if (vd.applies_to === 'category' && item.category_id && vd.category_ids?.includes(item.category_id)) return true;
      return false;
    });
    const qty = eligibleItems.reduce((sum, i) => sum + i.quantity, 0);
    const tiers = vd.volume_discount_tiers || [];
    const tier = tiers.filter((t: any) => qty >= t.min_quantity && (!t.max_quantity || qty <= t.max_quantity)).sort((a: any, b: any) => b.min_quantity - a.min_quantity)[0];
    if (tier) {
      const base = eligibleItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const discount = calculateDiscountValue(base, tier.discount_type, tier.discount_value);
      if (discount > 0) allDiscounts.push({ type: 'volume', name: vd.name, value: discount, source_id: vd.id, description: `Staffelkorting: ${tier.discount_value}${tier.discount_type === 'percentage' ? '%' : '€'}` });
    }
  }

  // 2. BOGO PROMOTIONS
  for (const promo of bogoPromotions || []) {
    if (!isPromotionActive(true, promo.valid_from, promo.valid_until)) continue;
    const buyItems = items.filter(item => {
      if (promo.buy_product_ids?.length) return promo.buy_product_ids.includes(item.product_id);
      if (promo.buy_category_ids?.length && item.category_id) return promo.buy_category_ids.includes(item.category_id);
      return promo.promotion_type === 'buy_x_get_y_same';
    });
    const buyQty = buyItems.reduce((sum, i) => sum + i.quantity, 0);
    if (buyQty < promo.buy_quantity) continue;
    let timesApplicable = Math.floor(buyQty / promo.buy_quantity);
    if (promo.max_uses_per_order) timesApplicable = Math.min(timesApplicable, promo.max_uses_per_order);
    const getItems = promo.promotion_type === 'buy_x_get_y_same' ? buyItems : items.filter(item => {
      if (promo.get_product_ids?.length) return promo.get_product_ids.includes(item.product_id);
      if (promo.get_category_ids?.length && item.category_id) return promo.get_category_ids.includes(item.category_id);
      return false;
    });
    let remaining = timesApplicable * promo.get_quantity;
    let discountTotal = 0;
    for (const item of getItems.sort((a, b) => a.price - b.price)) {
      if (remaining <= 0) break;
      const qty = Math.min(item.quantity, remaining);
      remaining -= qty;
      const itemTotal = item.price * qty;
      discountTotal += promo.discount_type === 'free' || promo.discount_value === 100 ? itemTotal : calculateDiscountValue(itemTotal, promo.discount_type, promo.discount_value);
    }
    if (discountTotal > 0) allDiscounts.push({ type: 'bogo', name: promo.name, value: discountTotal, source_id: promo.id });
  }

  // 3. BUNDLE DISCOUNTS
  for (const bundle of bundles || []) {
    if (!isPromotionActive(true, bundle.valid_from, bundle.valid_until)) continue;
    if (!bundle.bundle_products?.length) continue;
    if (bundle.bundle_type === 'fixed') {
      const required = bundle.bundle_products.filter((bp: any) => bp.is_required);
      let complete = true; let maxBundles = Infinity; let bundlePrice = 0;
      for (const bp of required) {
        const cartItem = items.find(i => i.product_id === bp.product_id);
        if (!cartItem || cartItem.quantity < bp.quantity) { complete = false; break; }
        maxBundles = Math.min(maxBundles, Math.floor(cartItem.quantity / bp.quantity));
        bundlePrice += (bp.products?.price || cartItem.price) * bp.quantity;
      }
      if (complete && maxBundles > 0 && maxBundles !== Infinity) {
        const discountPerBundle = bundle.discount_type === 'fixed_price' ? bundlePrice - bundle.discount_value :
          bundle.discount_type === 'percentage' ? bundlePrice * (bundle.discount_value / 100) : bundle.discount_value;
        const total = discountPerBundle * maxBundles;
        if (total > 0) allDiscounts.push({ type: 'bundle', name: bundle.name, value: total, source_id: bundle.id });
      }
    }
  }

  // 4. AUTOMATIC DISCOUNTS
  for (const ad of autoDiscounts || []) {
    if (!isPromotionActive(true, ad.valid_from, ad.valid_until)) continue;
    if (!checkSchedule(ad.schedule)) continue;
    let triggered = false;
    switch (ad.trigger_type) {
      case 'cart_total': triggered = ad.trigger_value ? originalSubtotal >= ad.trigger_value : false; break;
      case 'item_count': triggered = ad.trigger_value ? totalQuantity >= ad.trigger_value : false; break;
      case 'specific_products': triggered = ad.trigger_product_ids?.some((id: string) => cartProductIds.includes(id)) || false; break;
      case 'schedule': triggered = true; break;
      default: triggered = true;
    }
    if (!triggered) continue;
    if (ad.discount_type === 'free_shipping') {
      freeShipping = true; freeShippingReason = ad.name;
      allDiscounts.push({ type: 'automatic', name: ad.name, value: 0, source_id: ad.id, description: 'Gratis verzending' });
    } else if (ad.discount_type !== 'free_product') {
      const base = ad.applies_to === 'specific_products' && ad.product_ids ? items.filter(i => ad.product_ids.includes(i.product_id)).reduce((s, i) => s + i.price * i.quantity, 0) : originalSubtotal;
      const discount = calculateDiscountValue(base, ad.discount_type, ad.discount_value || 0, ad.max_discount_amount);
      if (discount > 0) allDiscounts.push({ type: 'automatic', name: ad.name, value: discount, source_id: ad.id });
    }
  }

  // 5. GIFT PROMOTIONS
  for (const gp of giftPromotions || []) {
    if (!isPromotionActive(true, gp.valid_from, gp.valid_until)) continue;
    if (gp.stock_limit && gp.stock_used >= gp.stock_limit) continue;
    let triggered = false;
    switch (gp.trigger_type) {
      case 'cart_total': case 'order_total': triggered = gp.trigger_value ? originalSubtotal >= gp.trigger_value : false; break;
      case 'quantity': case 'product_quantity': triggered = gp.trigger_value ? totalQuantity >= gp.trigger_value : false; break;
      case 'specific_products': triggered = gp.trigger_product_ids?.some((id: string) => cartProductIds.includes(id)) || false; break;
      default: triggered = true;
    }
    if (!triggered) continue;
    let giftQty = gp.gift_quantity;
    if (gp.max_per_order) giftQty = Math.min(giftQty, gp.max_per_order);
    if (gp.stock_limit) giftQty = Math.min(giftQty, gp.stock_limit - gp.stock_used);
    if (giftQty > 0 && (gp.is_stackable || gifts.length === 0)) {
      gifts.push({ product_id: gp.gift_product_id, product_name: gp.gift_product?.name || 'Cadeau', quantity: giftQty, promotion_id: gp.id, promotion_name: gp.name, product_image: gp.gift_product?.image_url });
    }
  }

  // 6. DISCOUNT CODE
  if (discountCodeData?.data) {
    const dc = discountCodeData.data;
    if (isPromotionActive(dc.is_active, dc.valid_from, dc.valid_until)) {
      if (!dc.usage_limit || dc.usage_count < dc.usage_limit) {
        if (!dc.minimum_order_amount || originalSubtotal >= dc.minimum_order_amount) {
          let base = originalSubtotal;
          if (dc.applies_to === 'specific_products' && dc.product_ids?.length) base = items.filter(i => dc.product_ids.includes(i.product_id)).reduce((s, i) => s + i.price * i.quantity, 0);
          const discount = calculateDiscountValue(base, dc.discount_type, dc.discount_value, dc.maximum_discount_amount);
          if (discount > 0) allDiscounts.push({ type: 'discount_code', name: dc.code, value: discount, source_id: dc.id, description: `${dc.discount_value}${dc.discount_type === 'percentage' ? '%' : '€'} korting` });
        }
      }
    }
  }

  // 7. CUSTOMER GROUP DISCOUNTS
  const customerGroups = (customerGroupData?.data || []).map((m: any) => m.customer_groups).filter(Boolean).sort((a: any, b: any) => a.priority - b.priority);
  const primaryGroup = customerGroups[0];
  if (primaryGroup?.is_active && primaryGroup.discount_type && primaryGroup.discount_value) {
    if (!primaryGroup.min_order_amount || originalSubtotal >= primaryGroup.min_order_amount) {
      const discount = calculateDiscountValue(originalSubtotal, primaryGroup.discount_type, primaryGroup.discount_value);
      if (discount > 0) allDiscounts.push({ type: 'customer_group', name: primaryGroup.name, value: discount, source_id: primaryGroup.id });
    }
  }

  // 8. STACKING RULES
  const activeRule = stackingRules?.[0];
  let finalDiscounts = allDiscounts;
  if (activeRule?.rule_type === 'no_stacking') {
    finalDiscounts = allDiscounts.sort((a, b) => b.value - a.value).slice(0, 1);
  } else if (activeRule) {
    if (activeRule.priority_order?.length) finalDiscounts = allDiscounts.sort((a, b) => { const aIdx = activeRule.priority_order.indexOf(a.type); const bIdx = activeRule.priority_order.indexOf(b.type); return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx); });
    if (activeRule.max_stack_count) finalDiscounts = finalDiscounts.slice(0, activeRule.max_stack_count);
    if (activeRule.max_total_discount_percent) { const maxDiscount = originalSubtotal * (activeRule.max_total_discount_percent / 100); let running = 0; finalDiscounts = finalDiscounts.filter(d => { if (running + d.value <= maxDiscount) { running += d.value; return true; } return false; }); }
  }

  const totalDiscount = finalDiscounts.reduce((sum, d) => sum + d.value, 0);
  return { original_subtotal: originalSubtotal, discounted_subtotal: Math.max(0, originalSubtotal - totalDiscount), total_discount: totalDiscount, applied_discounts: finalDiscounts, gifts, free_shipping: freeShipping, free_shipping_reason: freeShippingReason, loyalty_points_earned: 0, loyalty_points_redeemed: 0 };
}

async function validateDiscountCode(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const { code, subtotal = 0, customer_id } = params as { code: string; subtotal?: number; customer_id?: string };
  if (!code) return { valid: false, error: 'Geen kortingscode opgegeven' };
  const { data, error } = await supabase.from('discount_codes').select('*').eq('tenant_id', tenantId).eq('code', code).maybeSingle();
  if (error) throw error;
  if (!data) return { valid: false, error: 'Ongeldige kortingscode' };
  if (!isPromotionActive(data.is_active, data.valid_from, data.valid_until)) return { valid: false, error: 'Deze kortingscode is niet meer geldig' };
  if (data.usage_limit && data.usage_count >= data.usage_limit) return { valid: false, error: 'Deze kortingscode is niet meer beschikbaar' };
  if (data.minimum_order_amount && subtotal < data.minimum_order_amount) return { valid: false, error: `Minimaal bestelbedrag: €${data.minimum_order_amount.toFixed(2)}` };
  if (customer_id && data.usage_limit_per_customer) {
    const { count } = await supabase.from('discount_code_usage').select('*', { count: 'exact', head: true }).eq('discount_code_id', data.id).eq('customer_email', customer_id);
    if (count && count >= data.usage_limit_per_customer) return { valid: false, error: 'Je hebt deze kortingscode al gebruikt' };
  }
  return { valid: true, discount_type: data.discount_type, discount_value: data.discount_value, applies_to: data.applies_to, description: data.description };
}

// ============== CART ACTIONS ==============

async function cartCreate(supabase: any, tenantId: string, params: Record<string, unknown>) {
  // Auto-generate session_id if not provided
  const sessionId = (params.session_id as string) || crypto.randomUUID();
  const currency = (params.currency as string) || 'EUR';

  // Check for existing cart
  const { data: existing } = await supabase
    .from('storefront_carts').select('id')
    .eq('tenant_id', tenantId).eq('session_id', sessionId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing) {
    // Return full cart data instead of just id
    const cart = await cartGet(supabase, tenantId, { cart_id: existing.id });
    if (cart) return cart;
    return { id: existing.id, items: [], item_count: 0, subtotal: 0, shipping: 0, discount: 0, tax: 0, total: 0, currency };
  }

  const { data, error } = await supabase
    .from('storefront_carts')
    .insert({ tenant_id: tenantId, session_id: sessionId, currency })
    .select('id').single();
  if (error) {
    console.error('Cart creation DB error:', error);
    throw new Error('Failed to create cart: ' + (error.message || 'Unknown database error'));
  }
  return { id: data.id, session_id: sessionId, items: [], item_count: 0, subtotal: 0, shipping: 0, discount: 0, tax: 0, total: 0, currency };
}

async function cartGet(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const cartId = params.cart_id as string;
  const sessionId = params.session_id as string;
  if (!cartId && !sessionId) throw new Error('cart_id or session_id is required');

  let cartQuery = supabase.from('storefront_carts').select('*').eq('tenant_id', tenantId).gt('expires_at', new Date().toISOString());
  if (cartId) cartQuery = cartQuery.eq('id', cartId);
  else cartQuery = cartQuery.eq('session_id', sessionId);

  const { data: cart, error } = await cartQuery.maybeSingle();
  if (error) throw error;
  if (!cart) return null;

  const { data: items } = await supabase
    .from('storefront_cart_items')
    .select('id, product_id, variant_id, quantity, unit_price, gift_card_metadata, products(id, name, slug, images, price, track_inventory, stock, product_type)')
    .eq('cart_id', cart.id);

  // Fetch variant info for items that have variant_id
  const variantIds = (items || []).filter((i: any) => i.variant_id).map((i: any) => i.variant_id);
  let variantMap: Record<string, any> = {};
  if (variantIds.length > 0) {
    const { data: variants } = await supabase.from('product_variants').select('id, title, image_url, attribute_values, price, stock, track_inventory').in('id', variantIds);
    if (variants) variantMap = Object.fromEntries(variants.map((v: any) => [v.id, v]));
  }

  const cartItems = (items || []).map((item: any) => {
    const variant = item.variant_id ? variantMap[item.variant_id] : null;
    const productType = item.products?.product_type || 'physical';
    return {
      id: item.id, product_id: item.product_id, variant_id: item.variant_id || null,
      quantity: item.quantity, unit_price: item.unit_price || (item.gift_card_metadata as any)?.amount || variant?.price || item.products?.price || 0,
      product_type: productType,
      gift_card_metadata: item.gift_card_metadata || null,
      product: item.products ? { name: item.products.name, slug: item.products.slug, image: variant?.image_url || item.products.images?.[0] || null, current_price: item.products.price, in_stock: !item.products.track_inventory || item.products.stock > 0 } : null,
      variant: variant ? { title: variant.title, attribute_values: variant.attribute_values, image_url: variant.image_url, price: variant.price } : null,
      line_total: item.quantity * (item.unit_price || (item.gift_card_metadata as any)?.amount || variant?.price || item.products?.price || 0),
    };
  });

  const subtotal = cartItems.reduce((s: number, i: any) => s + i.line_total, 0);

  // Calculate discount if a discount_code is present
  let discountAmount = 0;
  let discountInfo: any = null;
  if (cart.discount_code) {
    const { data: dc } = await supabase.from('discount_codes')
      .select('*').eq('tenant_id', tenantId).eq('code', cart.discount_code).eq('is_active', true).maybeSingle();
    if (dc) {
      if (dc.discount_type === 'percentage') {
        discountAmount = Math.round(subtotal * (dc.discount_value / 100) * 100) / 100;
      } else {
        discountAmount = Math.min(dc.discount_value, subtotal);
      }
      if (dc.maximum_discount_amount) discountAmount = Math.min(discountAmount, dc.maximum_discount_amount);
      discountInfo = { discount_type: dc.discount_type, discount_value: dc.discount_value, applies_to: dc.applies_to, description: dc.description };
    }
  }

  return {
    id: cart.id, session_id: cart.session_id, currency: cart.currency, discount_code: cart.discount_code,
    items: cartItems, item_count: cartItems.reduce((s: number, i: any) => s + i.quantity, 0),
    subtotal, discount_amount: discountAmount, discount_info: discountInfo,
    total: Math.round(Math.max(0, subtotal - discountAmount) * 100) / 100, expires_at: cart.expires_at,
  };
}

async function cartAddItem(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const cartId = params.cart_id as string;
  const productId = params.product_id as string;
  const variantId = params.variant_id as string | undefined;
  const quantity = Math.max(1, Number(params.quantity) || 1);
  const giftCardMetadata = params.gift_card_metadata as Record<string, unknown> | undefined;
  const requestedAmount = params.amount as number | undefined;
  if (!cartId || !productId) throw new Error('cart_id and product_id are required');

  // Verify product exists and get price + type
  const { data: product } = await supabase
    .from('products').select('id, price, track_inventory, stock, is_active, product_type')
    .eq('id', productId).eq('tenant_id', tenantId).single();
  if (!product || !product.is_active) throw new Error('Product not found or inactive');

  const isGiftCard = product.product_type === 'gift_card';

  let unitPrice = product.price;
  let stockSource = product;
  let effectiveVariantId = variantId;

  if (isGiftCard) {
    // Gift cards: use requested amount, no variant, no stock check
    unitPrice = requestedAmount || product.price;
    effectiveVariantId = undefined;
  } else if (variantId) {
    // If variant_id provided, validate and use variant pricing/stock
    const { data: variant } = await supabase
      .from('product_variants').select('id, price, stock, track_inventory, is_active')
      .eq('id', variantId).eq('product_id', productId).eq('tenant_id', tenantId).single();
    if (!variant || !variant.is_active) throw new Error('Variant not found or inactive');
    unitPrice = variant.price ?? product.price;
    stockSource = variant;
  }

  // Skip stock check for gift cards and when tracking is disabled
  const shouldTrackInventory = !isGiftCard && product.track_inventory !== false && (!stockSource || stockSource === product || stockSource.track_inventory !== false);

  if (shouldTrackInventory && stockSource.stock < quantity) throw new Error('Insufficient stock');

  // Gift cards are always unique items — never merge
  if (!isGiftCard) {
    // Check if item already in cart (unique by product_id + variant_id)
    let existingQuery = supabase.from('storefront_cart_items').select('id, quantity').eq('cart_id', cartId).eq('product_id', productId);
    if (effectiveVariantId) existingQuery = existingQuery.eq('variant_id', effectiveVariantId);
    else existingQuery = existingQuery.is('variant_id', null);
    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (shouldTrackInventory && stockSource.stock < newQty) throw new Error('Insufficient stock');
      const { error } = await supabase.from('storefront_cart_items').update({ quantity: newQty, unit_price: unitPrice }).eq('id', existing.id);
      if (error) throw error;
      await supabase.from('storefront_carts').update({ updated_at: new Date().toISOString() }).eq('id', cartId);
      return cartGet(supabase, tenantId, { cart_id: cartId });
    }
  }

  // Insert new cart item
  const insertData: any = { cart_id: cartId, product_id: productId, quantity, unit_price: unitPrice };
  if (effectiveVariantId) insertData.variant_id = effectiveVariantId;
  if (isGiftCard && giftCardMetadata) insertData.gift_card_metadata = giftCardMetadata;
  const { error } = await supabase.from('storefront_cart_items').insert(insertData);
  if (error) throw error;

  await supabase.from('storefront_carts').update({ updated_at: new Date().toISOString() }).eq('id', cartId);
  return cartGet(supabase, tenantId, { cart_id: cartId });
}

async function cartUpdateItem(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const itemId = params.item_id as string;
  const quantity = Number(params.quantity);
  if (!itemId) throw new Error('item_id is required');
  if (quantity < 1) throw new Error('quantity must be at least 1');

  const { data: item } = await supabase.from('storefront_cart_items').select('id, cart_id, product_id, variant_id').eq('id', itemId).single();
  if (!item) throw new Error('Cart item not found');

  // Stock check — respect track_inventory on both product and variant level
  const { data: product } = await supabase.from('products').select('track_inventory, stock').eq('id', item.product_id).single();
  let shouldTrackInventory = product?.track_inventory !== false;
  let stockToCheck = product?.stock ?? 0;

  if (item.variant_id && shouldTrackInventory) {
    const { data: variant } = await supabase.from('product_variants').select('track_inventory, stock').eq('id', item.variant_id).single();
    if (variant) {
      if (variant.track_inventory === false) shouldTrackInventory = false;
      else stockToCheck = variant.stock ?? 0;
    }
  }

  if (shouldTrackInventory && stockToCheck < quantity) throw new Error('Insufficient stock');

  const { error } = await supabase.from('storefront_cart_items').update({ quantity }).eq('id', itemId);
  if (error) throw error;
  await supabase.from('storefront_carts').update({ updated_at: new Date().toISOString() }).eq('id', item.cart_id);
  return cartGet(supabase, tenantId, { cart_id: item.cart_id });
}

async function cartRemoveItem(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const itemId = params.item_id as string;
  if (!itemId) throw new Error('item_id is required');

  const { data: item } = await supabase.from('storefront_cart_items').select('cart_id').eq('id', itemId).single();
  if (!item) throw new Error('Cart item not found');

  const { error } = await supabase.from('storefront_cart_items').delete().eq('id', itemId);
  if (error) throw error;
  await supabase.from('storefront_carts').update({ updated_at: new Date().toISOString() }).eq('id', item.cart_id);
  return cartGet(supabase, tenantId, { cart_id: item.cart_id });
}

async function cartApplyDiscount(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const cartId = params.cart_id as string;
  const code = params.code as string;
  if (!cartId || !code) throw new Error('cart_id and code are required');

  // Validate code
  const validation = await validateDiscountCode(supabase, tenantId, { code });
  if (!validation.valid) throw new Error(validation.error);

  const { error } = await supabase.from('storefront_carts').update({ discount_code: code, updated_at: new Date().toISOString() }).eq('id', cartId).eq('tenant_id', tenantId);
  if (error) throw error;
  return cartGet(supabase, tenantId, { cart_id: cartId });
}

async function cartRemoveDiscount(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const cartId = params.cart_id as string;
  if (!cartId) throw new Error('cart_id is required');
  const { error } = await supabase.from('storefront_carts').update({ discount_code: null, updated_at: new Date().toISOString() }).eq('id', cartId).eq('tenant_id', tenantId);
  if (error) throw error;
  return cartGet(supabase, tenantId, { cart_id: cartId });
}

// ============== CHECKOUT ACTIONS ==============

async function checkoutStart(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const cartId = params.cart_id as string;
  if (!cartId) throw new Error('cart_id is required');

  const cart = await cartGet(supabase, tenantId, { cart_id: cartId });
  if (!cart || cart.items.length === 0) throw new Error('Cart is empty');

  // Return checkout summary
  return {
    cart_id: cartId,
    items: cart.items,
    subtotal: cart.subtotal,
    currency: cart.currency,
    discount_code: cart.discount_code,
    status: 'started',
  };
}

async function checkoutSetAddresses(supabase: any, tenantId: string, params: Record<string, unknown>) {
  // Store addresses temporarily — they'll be used when placing the order
  const { shipping_address, billing_address, email, phone } = params as {
    shipping_address: any; billing_address?: any; email: string; phone?: string;
  };
  if (!shipping_address || !email) throw new Error('shipping_address and email are required');
  return { status: 'addresses_set', shipping_address, billing_address: billing_address || shipping_address, email, phone };
}

async function checkoutGetShippingOptions(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const country = (params.country as string) || 'NL';
  const subtotal = Number(params.subtotal) || 0;

  const methods = await getShippingMethods(supabase, tenantId);
  return methods.map((m: any) => ({
    ...m,
    effective_price: m.free_above && subtotal >= m.free_above ? 0 : m.price,
  }));
}

async function checkoutGetPaymentMethods(supabase: any, tenantId: string) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('stripe_account_id, stripe_charges_enabled, bank_account_iban, bank_account_name')
    .eq('id', tenantId).single();

  const methods: any[] = [];
  if (tenant?.stripe_account_id && tenant?.stripe_charges_enabled) {
    methods.push({ id: 'stripe', name: 'Online betalen', description: 'Betaal met iDEAL, creditcard of andere methoden', type: 'online' });
  }
  if (tenant?.bank_account_iban) {
    methods.push({ id: 'bank_transfer', name: 'Bankoverschrijving', description: 'Betaal via bankoverschrijving', type: 'manual' });
  }
  return methods;
}

async function checkoutPlaceOrder(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const { cart_id, shipping_address, billing_address, email, phone, shipping_method_id, payment_method, customer_note } = params as {
    cart_id: string; shipping_address: any; billing_address?: any; email: string; phone?: string;
    shipping_method_id: string; payment_method: string; customer_note?: string;
  };

  // Check if all items are gift cards (digital-only order)
  // We need cart first to determine this
  const cart = await cartGet(supabase, tenantId, { cart_id });
  if (!cart || cart.items.length === 0) throw new Error('Cart is empty');

  const allGiftCards = cart.items.every((item: any) => item.product_type === 'gift_card');

  if (!allGiftCards && (!shipping_address || !shipping_method_id)) {
    throw new Error('shipping_address and shipping_method_id are required for physical orders');
  }
  if (!cart_id || !email || !payment_method) {
    throw new Error('cart_id, email, and payment_method are required');
  }

  // 2. Validate stock for all items (skip gift cards)
  for (const item of cart.items) {
    if (item.product_type !== 'gift_card' && item.product && !item.product.in_stock) {
      throw new Error(`${item.product.name} is niet meer op voorraad`);
    }
  }

  // 3. Get shipping method and cost
  let shippingCost = 0;
  let shippingMethod: any = null;
  if (allGiftCards) {
    // Digital-only order: no shipping needed
    shippingCost = 0;
  } else {
    const { data: sm } = await supabase
      .from('shipping_methods').select('id, name, price, free_above')
      .eq('id', shipping_method_id).eq('tenant_id', tenantId).single();
    if (!sm) throw new Error('Shipping method not found');
    shippingMethod = sm;
    shippingCost = shippingMethod.free_above && cart.subtotal >= shippingMethod.free_above ? 0 : shippingMethod.price;
  }

  // 4. Get tenant for VAT
  const { data: tenant } = await supabase
    .from('tenants').select('default_vat_rate, currency, stripe_account_id')
    .eq('id', tenantId).single();
  const vatRate = tenant?.default_vat_rate || 21;
  const subtotal = cart.subtotal;
  const vatAmount = Math.round(subtotal * (vatRate / (100 + vatRate)) * 100) / 100;
  const total = subtotal + shippingCost;

  // 5. Find or create customer
  let customerId: string | null = null;
  const { data: existingCustomer } = await supabase
    .from('customers').select('id')
    .eq('tenant_id', tenantId).eq('email', email).maybeSingle();

  if (existingCustomer) {
    customerId = existingCustomer.id;
  } else {
    const { data: newCustomer } = await supabase
      .from('customers')
      .insert({
        tenant_id: tenantId, email, first_name: shipping_address.first_name || '',
        last_name: shipping_address.last_name || '', phone: phone || null,
        customer_type: 'consumer', source: 'storefront',
      })
      .select('id').single();
    customerId = newCustomer?.id || null;
  }

  // 6. Generate order number
  const { data: orderNumber } = await supabase.rpc('generate_order_number', { _tenant_id: tenantId });

  // 7. Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId, customer_id: customerId, order_number: orderNumber,
      status: 'pending', payment_status: 'pending', payment_method,
      subtotal, shipping_cost: shippingCost, tax: vatAmount, total,
      currency: tenant?.currency || 'EUR',
      shipping_address, billing_address: billing_address || shipping_address,
      customer_email: email, customer_phone: phone || null,
      notes: customer_note || null,
      source: 'storefront',
    })
    .select('id, order_number').single();
  if (orderError) throw orderError;

  // 8. Create order items (with variant support)
  const orderItems = cart.items.map((item: any) => {
    const oi: any = {
      order_id: order.id, tenant_id: tenantId, product_id: item.product_id,
      product_name: item.product?.name || '', quantity: item.quantity,
      unit_price: item.unit_price, total: item.line_total,
      sku: null, product_image: item.product?.image || null,
      variant_id: item.variant_id || null,
      variant_title: item.variant?.title || null,
    };
    if (item.product_type === 'gift_card' && item.gift_card_metadata) {
      oi.gift_card_metadata = item.gift_card_metadata;
    }
    return oi;
  });

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) throw itemsError;

  // 9. Decrement stock (variant-level if applicable, skip gift cards)
  for (const item of cart.items) {
    if (item.product_type === 'gift_card') continue;
    if (item.variant_id) {
      await supabase.rpc('decrement_variant_stock', { p_variant_id: item.variant_id, p_quantity: item.quantity });
    } else {
      await supabase.rpc('decrement_stock', { p_product_id: item.product_id, p_quantity: item.quantity });
    }
  }

  // 9b. Process gift card items
  const giftCardItems = cart.items.filter((item: any) => item.product_type === 'gift_card');
  if (giftCardItems.length > 0) {
    try {
      await supabase.functions.invoke('process-gift-card-order', {
        body: {
          order_id: order.id,
          tenant_id: tenantId,
          items: giftCardItems.map((item: any) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            gift_card_metadata: item.gift_card_metadata,
          })),
        },
      });
    } catch (gcError) {
      console.error('Gift card processing error (non-blocking):', gcError);
    }
  }

  // 10. Clear cart
  await supabase.from('storefront_cart_items').delete().eq('cart_id', cart_id);
  await supabase.from('storefront_carts').delete().eq('id', cart_id);

  // 11. Handle payment
  if (payment_method === 'stripe' && tenant?.stripe_account_id) {
    // Create Stripe checkout session via the existing create-checkout-session function pattern
    const Stripe = (await import("https://esm.sh/stripe@14.21.0")).default;
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2023-10-16' });

    const lineItems = cart.items.map((item: any) => ({
      price_data: {
        currency: (tenant?.currency || 'EUR').toLowerCase(),
        product_data: { name: item.product?.name || 'Product' },
        unit_amount: Math.round(item.unit_price * 100),
      },
      quantity: item.quantity,
    }));

    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: (tenant?.currency || 'EUR').toLowerCase(),
          product_data: { name: shippingMethod.name || 'Verzending' },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      });
    }

    const origin = params.origin as string || 'https://sellqo.lovable.app';
    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/order-confirmation?order_id=${order.id}`,
      cancel_url: `${origin}/checkout?cancelled=true`,
      customer_email: email,
      metadata: { order_id: order.id, tenant_id: tenantId },
      payment_intent_data: {
        application_fee_amount: Math.round(total * 0.05 * 100), // 5% platform fee
        transfer_data: { destination: tenant.stripe_account_id },
      },
    });

    return { order_id: order.id, order_number: order.order_number, payment_url: session.url, payment_method: 'stripe' };
  }

  // Bank transfer
  return { order_id: order.id, order_number: order.order_number, payment_method: 'bank_transfer', total };
}

async function checkoutGetConfirmation(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const orderId = params.order_id as string;
  if (!orderId) throw new Error('order_id is required');

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, order_number, status, payment_status, payment_method, subtotal, shipping_cost, tax, total, currency, shipping_address, customer_email, created_at')
    .eq('id', orderId).eq('tenant_id', tenantId).single();
  if (error) throw error;
  if (!order) throw new Error('Order not found');

  const { data: items } = await supabase
    .from('order_items')
    .select('product_name, quantity, unit_price, total, product_image')
    .eq('order_id', orderId);

  return { ...order, items: items || [] };
}

// ============== NEWSLETTER SUBSCRIBE ==============

async function newsletterSubscribe(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const email = (params.email as string || '').trim().toLowerCase();
  const firstName = (params.first_name as string) || undefined;
  const source = (params.source as string) || 'storefront_api';

  if (!email) throw new Error('email is required');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) throw new Error('Invalid email format');

  // Check if already subscribed
  const { data: existing } = await supabase
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('email', email)
    .maybeSingle();

  if (existing?.status === 'active') {
    return { message: 'Already subscribed', provider: 'internal', double_optin: false };
  }

  if (existing) {
    await supabase.from('newsletter_subscribers').update({
      status: 'pending', sync_status: 'pending', unsubscribed_at: null,
      subscribed_at: new Date().toISOString(),
    }).eq('id', existing.id);
  } else {
    const { error } = await supabase.from('newsletter_subscribers').insert({
      tenant_id: tenantId, email, first_name: firstName || null, source, status: 'pending', sync_status: 'pending',
    });
    if (error) throw error;
  }

  // Get tenant newsletter config
  const { data: config } = await supabase
    .from('tenant_newsletter_config').select('provider, double_optin, mailchimp_api_key, mailchimp_audience_id, mailchimp_server_prefix, klaviyo_api_key, klaviyo_list_id')
    .eq('tenant_id', tenantId).maybeSingle();

  const provider = config?.provider || 'internal';
  const doubleOptin = config?.double_optin || false;

  // For external providers, invoke the dedicated newsletter-subscribe function
  if (provider !== 'internal' && (config?.mailchimp_api_key || config?.klaviyo_api_key)) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const res = await fetch(`${supabaseUrl}/functions/v1/newsletter-subscribe`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, email, firstName, source }),
      });
      const data = await res.json();
      return { message: data.message || 'Subscribed', provider, double_optin: doubleOptin };
    } catch (e) {
      console.error('Newsletter sync error:', e);
    }
  }

  // Internal: mark active directly
  await supabase.from('newsletter_subscribers').update({
    status: doubleOptin ? 'pending' : 'active',
    sync_status: 'synced',
    confirmed_at: doubleOptin ? null : new Date().toISOString(),
  }).eq('tenant_id', tenantId).eq('email', email);

  return {
    message: doubleOptin ? 'Please check your email to confirm' : 'Successfully subscribed',
    provider, double_optin: doubleOptin,
  };
}

// ============== REST HELPERS ==============

function jsonResponse(data: any, status = 200, cacheControl?: string) {
  const headers: Record<string, string> = { ...corsHeaders, 'Content-Type': 'application/json' };
  if (cacheControl) headers['Cache-Control'] = cacheControl;
  else if (status === 200) headers['Cache-Control'] = 'public, max-age=60';
  else headers['Cache-Control'] = 'no-cache';
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(error: string, status = 400, code?: string) {
  return jsonResponse({ success: false, error, ...(code ? { code } : {}) }, status, 'no-cache');
}

// ============== API KEY VALIDATION ==============

async function validateApiKey(supabase: any, tenantId: string, apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  const { data: themeSettings } = await supabase
    .from('tenant_theme_settings')
    .select('custom_frontend_config')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const config = themeSettings?.custom_frontend_config;
  if (!config?.api_key_hash) return false;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(apiKey));
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === config.api_key_hash;
}

// ============== MODULE CHECK ==============

function isModuleEnabled(config: any, module: string): boolean {
  if (!config) return true;
  const moduleConfig = config[module];
  if (!moduleConfig) return true;
  if (typeof moduleConfig === 'object' && 'enabled' in moduleConfig) return moduleConfig.enabled;
  return true;
}

// ============== NAVIGATION HANDLER ==============

async function getNavigation(supabase: any, tenantId: string, locale?: string) {
  const { data: ts } = await supabase
    .from('tenant_theme_settings')
    .select('show_announcement_bar, announcement_text, announcement_link, primary_color')
    .eq('tenant_id', tenantId).maybeSingle();

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id, sort_order, hide_from_storefront')
    .eq('tenant_id', tenantId).eq('is_active', true).eq('hide_from_storefront', false)
    .order('sort_order', { ascending: true });

  const tMap = locale && categories?.length
    ? await getTranslations(supabase, tenantId, 'category', categories.map((c: any) => c.id), locale) : {};

  const topLevel = (categories || []).filter((c: any) => !c.parent_id);
  const children = (categories || []).filter((c: any) => c.parent_id);

  const mainMenu = [
    { id: 'home', label: 'Home', url: '/', children: [] },
    { id: 'shop', label: 'Shop', url: '/shop', children: topLevel.map((cat: any) => {
      const t = tMap[cat.id] || {};
      const catChildren = children.filter((c: any) => c.parent_id === cat.id).map((c: any) => {
        const ct = tMap[c.id] || {};
        return { id: c.id, label: ct.name || c.name, url: `/shop/${c.slug}`, children: [] };
      });
      return { id: cat.id, label: t.name || cat.name, url: `/shop/${cat.slug}`, children: catChildren };
    })},
  ];

  const { data: pages } = await supabase
    .from('pages').select('id, title, slug, show_in_nav')
    .eq('tenant_id', tenantId).eq('is_published', true).order('nav_order', { ascending: true });

  const footerMenu = (pages || []).map((p: any) => ({
    id: p.id, label: p.title, url: `/${p.slug}`, children: [],
  }));

  const langField = locale && ['en', 'de', 'fr'].includes(locale) ? locale : 'nl';
  const { data: legalPages } = await supabase
    .from('legal_pages')
    .select(`id, page_type, title_${langField}, is_published`)
    .eq('tenant_id', tenantId).eq('is_published', true);

  const legalMenuItems = (legalPages || []).map((p: any) => ({
    id: p.id, label: p[`title_${langField}`] || p.page_type, url: `/legal/${p.page_type}`, children: [],
  }));

  return {
    main: mainMenu,
    footer: [...footerMenu, ...legalMenuItems],
    announcement: ts?.show_announcement_bar && ts?.announcement_text ? {
      text: ts.announcement_text, link: ts.announcement_link || null, is_visible: true,
      background_color: ts.primary_color || '#FF6B35', text_color: '#FFFFFF',
    } : null,
  };
}

// ============== SETTINGS SUB-ENDPOINTS ==============

async function getSettingsSocial(supabase: any, tenantId: string) {
  const { data: tenant } = await supabase.from('tenants')
    .select('social_facebook, social_instagram, social_twitter, social_linkedin, social_tiktok, social_youtube')
    .eq('id', tenantId).single();
  return {
    facebook: tenant?.social_facebook || null, instagram: tenant?.social_instagram || null,
    twitter: tenant?.social_twitter || null, linkedin: tenant?.social_linkedin || null,
    tiktok: tenant?.social_tiktok || null, youtube: tenant?.social_youtube || null,
  };
}

async function getSettingsTrust(supabase: any, tenantId: string) {
  const { data: ts } = await supabase.from('tenant_theme_settings')
    .select('cookie_banner_enabled, cookie_banner_style, trust_badges')
    .eq('tenant_id', tenantId).maybeSingle();
  return {
    cookie_banner: { enabled: ts?.cookie_banner_enabled ?? true, style: ts?.cookie_banner_style || 'minimal' },
    badges: ts?.trust_badges || [], usps: [],
  };
}

async function getSettingsConversion(supabase: any, tenantId: string) {
  const { data: ts } = await supabase.from('tenant_theme_settings')
    .select('show_stock_count, show_viewers_count, show_recent_purchases, exit_intent_popup')
    .eq('tenant_id', tenantId).maybeSingle();
  return {
    stock_urgency: { enabled: ts?.show_stock_count ?? false, threshold: 5 },
    recent_purchases: { enabled: ts?.show_recent_purchases ?? false },
    free_shipping_bar: { enabled: true, threshold: 50, currency: 'EUR' },
  };
}

async function getSettingsCheckout(supabase: any, tenantId: string) {
  const { data: ts } = await supabase.from('tenant_theme_settings')
    .select('checkout_guest_enabled, checkout_phone_required, checkout_company_field, checkout_address_autocomplete')
    .eq('tenant_id', tenantId).maybeSingle();
  return {
    mode: 'hosted', guest_checkout: ts?.checkout_guest_enabled ?? true,
    phone_required: ts?.checkout_phone_required ?? false,
    company_field: ts?.checkout_company_field || 'optional',
    address_autocomplete: ts?.checkout_address_autocomplete ?? true,
  };
}

async function getSettingsLanguages(supabase: any, tenantId: string) {
  const [{ data: tenant }, { data: domains }] = await Promise.all([
    supabase.from('tenants').select('default_language').eq('id', tenantId).single(),
    supabase.from('tenant_domains').select('domain, locale, is_canonical').eq('tenant_id', tenantId).eq('is_active', true),
  ]);
  const languages = [...new Set((domains || []).map((d: any) => d.locale).filter(Boolean))];
  const names: Record<string, string> = { nl: 'Nederlands', en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español' };
  return {
    available: languages.map((code: string) => ({ code, name: names[code] || code })),
    default: tenant?.default_language || 'nl',
  };
}

// ============== PRODUCT REVIEWS BY SLUG ==============

async function getProductReviews(supabase: any, tenantId: string, slug: string) {
  const { data: product } = await supabase.from('products').select('id')
    .eq('tenant_id', tenantId).eq('slug', slug).eq('is_active', true).maybeSingle();
  if (!product) throw new Error('Product not found');

  const { data: reviews } = await supabase.from('external_reviews')
    .select('id, reviewer_name, rating, review_text, created_at, platform')
    .eq('tenant_id', tenantId).eq('product_id', product.id).eq('is_visible', true)
    .order('created_at', { ascending: false }).limit(50);

  const items = reviews || [];
  const avgRating = items.length ? items.reduce((s: number, r: any) => s + r.rating, 0) / items.length : null;
  const distribution: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
  for (const r of items) { const key = String(Math.round(r.rating)); if (distribution[key] !== undefined) distribution[key]++; }

  return { reviews: items, summary: { average_rating: avgRating ? Math.round(avgRating * 10) / 10 : null, total_count: items.length, distribution } };
}

// ============== RELATED PRODUCTS BY SLUG ==============

async function getRelatedProducts(supabase: any, tenantId: string, slug: string, limit: number, locale?: string) {
  const { data: product } = await supabase.from('products').select('id, category_id')
    .eq('tenant_id', tenantId).eq('slug', slug).eq('is_active', true).maybeSingle();
  if (!product || !product.category_id) return [];

  const { data: related } = await supabase.from('products')
    .select('id, name, slug, price, compare_at_price, images')
    .eq('tenant_id', tenantId).eq('is_active', true).eq('hide_from_storefront', false)
    .eq('category_id', product.category_id).neq('id', product.id).limit(limit);

  const tMap = locale && related?.length ? await getTranslations(supabase, tenantId, 'product', related.map((r: any) => r.id), locale) : {};
  return (related || []).map((r: any) => {
    const t = tMap[r.id] || {};
    return { id: r.id, name: t.name || r.name, slug: r.slug, price: r.price, compare_at_price: r.compare_at_price, image: r.images?.[0] || null };
  });
}

// ============== GIFT CARD HANDLERS ==============

async function getGiftCardDenominations(supabase: any, tenantId: string) {
  const { data } = await supabase.from('gift_cards')
    .select('initial_amount').eq('tenant_id', tenantId).eq('status', 'active');
  const amounts = [...new Set((data || []).map((g: any) => g.initial_amount))].sort((a: number, b: number) => a - b);
  return { denominations: amounts.length > 0 ? amounts : [10, 25, 50, 100], currency: 'EUR' };
}

async function checkGiftCardBalance(supabase: any, tenantId: string, code: string) {
  if (!code) throw new Error('Gift card code is required');
  const { data } = await supabase.from('gift_cards')
    .select('current_balance, currency, status, expires_at')
    .eq('tenant_id', tenantId).eq('code', code.toUpperCase().trim()).maybeSingle();
  if (!data) throw new Error('Gift card not found');
  if (data.status !== 'active') throw new Error('Gift card is not active');
  if (data.expires_at && new Date(data.expires_at) < new Date()) throw new Error('Gift card has expired');
  return { balance: data.current_balance, currency: data.currency || 'EUR' };
}

// ============== RATE LIMITING ==============

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(tenantId: string, limit = 1000, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(tenantId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(tenantId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

// ============== MODULE MAP ==============

const resourceModuleMap: Record<string, string> = {
  products: 'products', collections: 'collections', categories: 'collections',
  cart: 'cart', checkout: 'checkout', 'gift-cards': 'gift_cards',
  pages: 'pages', navigation: 'navigation', reviews: '',
  newsletter: 'newsletter', search: '', shipping: '', settings: '',
  legal: '', contact: '',
};

// ============== MAIN HANDLER ==============

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const url = new URL(req.url);
    // Strip everything up to and including 'storefront-api' from the path
    const pathIdx = url.pathname.indexOf('storefront-api');
    const restPath = pathIdx >= 0 ? url.pathname.substring(pathIdx + 'storefront-api'.length) : url.pathname;
    const pathParts = restPath.split('/').filter(Boolean);
    const resource = pathParts[0] || '';
    const resourceId = pathParts[1] || '';
    const subResource = pathParts[2] || '';
    const subResourceId = pathParts[3] || '';

    const tenantIdHeader = req.headers.get('x-tenant-id');
    const apiKeyHeader = req.headers.get('x-api-key');
    const locale = req.headers.get('accept-language')?.split(',')[0]?.split('-')[0]?.trim() || 'nl';

    // ---- BACKWARD COMPATIBILITY: POST-body action approach ----
    if (req.method === 'POST' && !resource) {
      const body: StorefrontRequest = await req.json();
      // If body has 'action' field, use legacy routing
      if (body.action) {
        const { action, tenant_id, params = {} } = body;

        if (action === 'resolve_domain') {
          return new Response(JSON.stringify({ success: true, data: await resolveDomain(supabase, params) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (!tenant_id) {
          return new Response(JSON.stringify({ success: false, error: 'tenant_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (!checkRateLimit(tenant_id)) {
          return new Response(JSON.stringify({ success: false, error: 'Too many requests' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });
        }

        let result: unknown;
        let cacheControl: string | null = null;

        switch (action) {
          case 'get_tenant': result = await getTenant(supabase, tenant_id, params); cacheControl = 'public, max-age=300'; break;
          case 'get_config': result = await getConfig(supabase, tenant_id, params); cacheControl = 'public, max-age=300'; break;
          case 'get_products': result = await getProducts(supabase, tenant_id, params); cacheControl = 'public, max-age=60'; break;
          case 'get_product': result = await getProduct(supabase, tenant_id, params); cacheControl = 'public, max-age=60'; break;
          case 'get_categories': result = await getCategories(supabase, tenant_id, params); cacheControl = 'public, max-age=300'; break;
          case 'get_pages': result = await getPages(supabase, tenant_id, params); cacheControl = 'public, max-age=300'; break;
          case 'get_homepage': result = await getHomepage(supabase, tenant_id); cacheControl = 'public, max-age=300'; break;
          case 'get_reviews': result = await getReviews(supabase, tenant_id, params); cacheControl = 'public, max-age=120'; break;
          case 'get_shipping_methods': result = await getShippingMethods(supabase, tenant_id); cacheControl = 'public, max-age=300'; break;
          case 'get_service_points': result = await getServicePoints(supabase, tenant_id, params); break;
          case 'calculate_promotions': result = await calculatePromotions(supabase, tenant_id, params); break;
          case 'validate_discount_code': result = await validateDiscountCode(supabase, tenant_id, params); break;
          case 'search_products': result = await searchProducts(supabase, tenant_id, params); break;
          case 'get_seo': result = await getSeo(supabase, tenant_id, params); cacheControl = 'public, max-age=600'; break;
          case 'get_sitemap_data': result = await getSitemapData(supabase, tenant_id); cacheControl = 'public, max-age=3600'; break;
          case 'newsletter_subscribe': result = await newsletterSubscribe(supabase, tenant_id, params); break;
          case 'cart_create': result = await cartCreate(supabase, tenant_id, params); break;
          case 'cart_get': result = await cartGet(supabase, tenant_id, params); break;
          case 'cart_add_item': result = await cartAddItem(supabase, tenant_id, params); break;
          case 'cart_update_item': result = await cartUpdateItem(supabase, tenant_id, params); break;
          case 'cart_remove_item': result = await cartRemoveItem(supabase, tenant_id, params); break;
          case 'cart_apply_discount': result = await cartApplyDiscount(supabase, tenant_id, params); break;
          case 'cart_remove_discount': result = await cartRemoveDiscount(supabase, tenant_id, params); break;
          case 'checkout_start': result = await checkoutStart(supabase, tenant_id, params); break;
          case 'checkout_set_addresses': result = await checkoutSetAddresses(supabase, tenant_id, params); break;
          case 'checkout_get_shipping_options': result = await checkoutGetShippingOptions(supabase, tenant_id, params); break;
          case 'checkout_get_payment_methods': result = await checkoutGetPaymentMethods(supabase, tenant_id); break;
          case 'checkout_place_order': result = await checkoutPlaceOrder(supabase, tenant_id, params); break;
          case 'checkout_get_confirmation': result = await checkoutGetConfirmation(supabase, tenant_id, params); break;
          default:
            return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const responseHeaders: Record<string, string> = { ...corsHeaders, 'Content-Type': 'application/json' };
        if (cacheControl) responseHeaders['Cache-Control'] = cacheControl;
        return new Response(JSON.stringify({ success: true, data: result }), { headers: responseHeaders });
      }
    }

    // ---- RESTful URL ROUTING ----

    if (!tenantIdHeader) return errorResponse('X-Tenant-ID header is required', 400, 'MISSING_TENANT_ID');

    // Resolve tenant (by slug or UUID)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdHeader);
    const tenantQuery = supabase.from('tenants').select('id, slug').limit(1);
    if (isUuid) tenantQuery.eq('id', tenantIdHeader);
    else tenantQuery.eq('slug', tenantIdHeader);
    const { data: tenantRow } = await tenantQuery.maybeSingle();
    if (!tenantRow) return errorResponse('Tenant not found', 404, 'TENANT_NOT_FOUND');
    const tenantId = tenantRow.id;

    // Rate limit
    if (!checkRateLimit(tenantId)) return errorResponse('Too many requests', 429, 'RATE_LIMIT_EXCEEDED');

    // Validate API key
    if (apiKeyHeader) {
      const valid = await validateApiKey(supabase, tenantId, apiKeyHeader);
      if (!valid) return errorResponse('Invalid API key', 401, 'INVALID_API_KEY');
    } else {
      // API key required for RESTful mode
      return errorResponse('X-API-Key header is required', 401, 'MISSING_API_KEY');
    }

    // Load custom_frontend_config for module checks
    const { data: tsCfg } = await supabase.from('tenant_theme_settings')
      .select('custom_frontend_config').eq('tenant_id', tenantId).maybeSingle();
    const frontendConfig = tsCfg?.custom_frontend_config || null;

    // Check module enabled
    const requiredModule = resourceModuleMap[resource];
    if (requiredModule && !isModuleEnabled(frontendConfig, requiredModule)) {
      return errorResponse(`Module '${requiredModule}' is not enabled`, 403, 'MODULE_DISABLED');
    }

    if (!resource) return errorResponse('Endpoint not found', 404, 'NOT_FOUND');

    const method = req.method;
    const sp = url.searchParams;

    // ---- PRODUCTS ----
    if (resource === 'products') {
      if (method !== 'GET') return errorResponse('Method not allowed', 405);
      if (resourceId && subResource === 'related') {
        const limit = Number(sp.get('limit')) || 4;
        return jsonResponse({ success: true, data: await getRelatedProducts(supabase, tenantId, resourceId, limit, locale) }, 200, 'public, max-age=60');
      }
      if (resourceId && subResource === 'reviews') {
        return jsonResponse({ success: true, data: await getProductReviews(supabase, tenantId, resourceId) }, 200, 'public, max-age=120');
      }
      if (resourceId) {
        return jsonResponse({ success: true, data: await getProduct(supabase, tenantId, { slug: resourceId, locale }) }, 200, 'public, max-age=60');
      }
      // List products
      const params: Record<string, unknown> = {
        locale, page: sp.get('page') || 1, per_page: sp.get('per_page') || 24,
        sort_by: sp.get('sort') || sp.get('sort_by') || 'newest',
        category_slug: sp.get('category_slug') || sp.get('collection') || sp.get('category') || undefined,
        search: sp.get('search') || sp.get('q') || undefined,
        min_price: sp.get('min_price') || undefined, max_price: sp.get('max_price') || undefined,
        tags: sp.get('tags') ? (sp.get('tags') as string).split(',') : undefined,
        in_stock_only: sp.get('in_stock') === 'true',
        is_featured: sp.get('featured') === 'true',
      };
      return jsonResponse({ success: true, data: await getProducts(supabase, tenantId, params) }, 200, 'public, max-age=60');
    }

    // ---- COLLECTIONS ----
    if (resource === 'collections') {
      if (method !== 'GET') return errorResponse('Method not allowed', 405);
      if (resourceId && subResource === 'products') {
        const params: Record<string, unknown> = {
          locale, category_slug: resourceId,
          page: sp.get('page') || 1, per_page: sp.get('per_page') || 24,
          sort_by: sp.get('sort') || 'newest',
        };
        return jsonResponse({ success: true, data: await getProducts(supabase, tenantId, params) }, 200, 'public, max-age=60');
      }
      if (resourceId) {
        const cats = await getCategories(supabase, tenantId, { locale, hide_empty: sp.get('hide_empty') });
        const cat = (cats as any[]).find((c: any) => c.slug === resourceId);
        if (!cat) return errorResponse('Collection not found', 404);
        return jsonResponse({ success: true, data: cat }, 200, 'public, max-age=300');
      }
      return jsonResponse({ success: true, data: await getCategories(supabase, tenantId, { locale, hide_empty: sp.get('hide_empty') }) }, 200, 'public, max-age=300');
    }

    // ---- CATEGORIES ----
    if (resource === 'categories') {
      if (method !== 'GET') return errorResponse('Method not allowed', 405);
      return jsonResponse({ success: true, data: await getCategories(supabase, tenantId, { locale }) }, 200, 'public, max-age=300');
    }

    // ---- CART ----
    if (resource === 'cart') {
      if (method === 'POST' && !resourceId) {
        let body: any = {};
        try { body = await req.json(); } catch { body = {}; }
        return jsonResponse({ success: true, data: await cartCreate(supabase, tenantId, { session_id: body.session_id, currency: body.currency }) }, 201, 'no-cache');
      }
      if (method === 'GET' && resourceId) {
        return jsonResponse({ success: true, data: await cartGet(supabase, tenantId, { cart_id: resourceId }) }, 200, 'no-cache');
      }
      if (method === 'POST' && resourceId && subResource === 'items') {
        const body = await req.json();
        return jsonResponse({ success: true, data: await cartAddItem(supabase, tenantId, { cart_id: resourceId, ...body }) }, 200, 'no-cache');
      }
      if (method === 'PUT' && resourceId && subResource === 'items' && subResourceId) {
        const body = await req.json();
        return jsonResponse({ success: true, data: await cartUpdateItem(supabase, tenantId, { item_id: subResourceId, ...body }) }, 200, 'no-cache');
      }
      if (method === 'PATCH' && resourceId && subResource === 'items' && subResourceId) {
        const body = await req.json();
        return jsonResponse({ success: true, data: await cartUpdateItem(supabase, tenantId, { item_id: subResourceId, ...body }) }, 200, 'no-cache');
      }
      if (method === 'DELETE' && resourceId && subResource === 'items' && subResourceId) {
        return jsonResponse({ success: true, data: await cartRemoveItem(supabase, tenantId, { item_id: subResourceId }) }, 200, 'no-cache');
      }
      if (method === 'POST' && resourceId && subResource === 'discount') {
        const body = await req.json();
        return jsonResponse({ success: true, data: await cartApplyDiscount(supabase, tenantId, { cart_id: resourceId, ...body }) }, 200, 'no-cache');
      }
      if (method === 'DELETE' && resourceId && subResource === 'discount') {
        return jsonResponse({ success: true, data: await cartRemoveDiscount(supabase, tenantId, { cart_id: resourceId }) }, 200, 'no-cache');
      }
      return errorResponse('Cart endpoint not found', 404);
    }

    // ---- CHECKOUT ----
    if (resource === 'checkout') {
      if (method !== 'POST') return errorResponse('Method not allowed', 405);
      let body: any = {};
      try { body = await req.json(); } catch { throw new Error('Invalid JSON body'); }

      // Simple flow: if only cart_id + success_url/cancel_url, return hosted checkout URL
      if (body.cart_id && !body.shipping_address && !body.payment_method) {
        const cart = await cartGet(supabase, tenantId, { cart_id: body.cart_id });
        if (!cart || cart.items.length === 0) throw new Error('Cart is empty');

        // Get tenant info for checkout URL
        const { data: tenantInfo } = await supabase.from('tenants').select('slug').eq('id', tenantId).single();
        const tenantSlug = tenantInfo?.slug || tenantId;

        // Build hosted checkout URL with cart and redirect params
        const checkoutBaseUrl = `https://sellqo.lovable.app/shop/${tenantSlug}/checkout`;
        const checkoutUrl = new URL(checkoutBaseUrl);
        checkoutUrl.searchParams.set('cart_id', body.cart_id);
        if (body.success_url) checkoutUrl.searchParams.set('success_url', body.success_url);
        if (body.cancel_url) checkoutUrl.searchParams.set('cancel_url', body.cancel_url);

        return jsonResponse({
          success: true,
          data: {
            checkout_url: checkoutUrl.toString(),
            cart_id: body.cart_id,
            item_count: cart.item_count,
            subtotal: cart.subtotal,
            currency: cart.currency,
          }
        }, 200, 'no-cache');
      }

      // Full checkout flow: place order directly
      return jsonResponse({ success: true, data: await checkoutPlaceOrder(supabase, tenantId, { ...body, origin: body.success_url ? new URL(body.success_url).origin : url.origin }) }, 200, 'no-cache');
    }

    // ---- GIFT CARDS ----
    if (resource === 'gift-cards') {
      if (method === 'GET' && !resourceId) {
        return jsonResponse({ success: true, data: await getGiftCardDenominations(supabase, tenantId) }, 200, 'public, max-age=300');
      }
      if (method === 'POST' && resourceId === 'balance') {
        const body = await req.json();
        return jsonResponse({ success: true, data: await checkGiftCardBalance(supabase, tenantId, body.code) }, 200, 'no-cache');
      }
      return errorResponse('Gift cards endpoint not found', 404);
    }

    // ---- PAGES ----
    if (resource === 'pages') {
      if (method !== 'GET') return errorResponse('Method not allowed', 405);
      if (resourceId) {
        return jsonResponse({ success: true, data: await getPages(supabase, tenantId, { slug: resourceId, locale }) }, 200, 'public, max-age=600');
      }
      return jsonResponse({ success: true, data: await getPages(supabase, tenantId, { locale, type: sp.get('type') || undefined }) }, 200, 'public, max-age=600');
    }

    // ---- NAVIGATION ----
    if (resource === 'navigation') {
      if (method !== 'GET') return errorResponse('Method not allowed', 405);
      return jsonResponse({ success: true, data: await getNavigation(supabase, tenantId, locale) }, 200, 'public, max-age=300');
    }

    // ---- REVIEWS ----
    if (resource === 'reviews') {
      if (method !== 'GET') return errorResponse('Method not allowed', 405);
      if (resourceId === 'summary') {
        const result = await getReviews(supabase, tenantId, { limit: 0 });
        return jsonResponse({ success: true, data: { average_rating: result.average_rating, total_count: result.total_count } }, 200, 'public, max-age=120');
      }
      const params: Record<string, unknown> = {
        limit: sp.get('limit') || 20, page: sp.get('page') || 1,
        featured_only: sp.get('featured') === 'true',
      };
      return jsonResponse({ success: true, data: await getReviews(supabase, tenantId, params) }, 200, 'public, max-age=120');
    }

    // ---- NEWSLETTER ----
    if (resource === 'newsletter') {
      if (method === 'POST' && resourceId === 'subscribe') {
        const body = await req.json();
        return jsonResponse({ success: true, data: await newsletterSubscribe(supabase, tenantId, { ...body, locale }) }, 200, 'no-cache');
      }
      return errorResponse('Newsletter endpoint not found', 404);
    }

    // ---- SETTINGS ----
    if (resource === 'settings') {
      if (method !== 'GET') return errorResponse('Method not allowed', 405);
      switch (resourceId) {
        case 'social': return jsonResponse({ success: true, data: await getSettingsSocial(supabase, tenantId) }, 200, 'public, max-age=300');
        case 'trust': return jsonResponse({ success: true, data: await getSettingsTrust(supabase, tenantId) }, 200, 'public, max-age=300');
        case 'conversion': return jsonResponse({ success: true, data: await getSettingsConversion(supabase, tenantId) }, 200, 'public, max-age=300');
        case 'checkout': return jsonResponse({ success: true, data: await getSettingsCheckout(supabase, tenantId) }, 200, 'public, max-age=300');
        case 'languages': return jsonResponse({ success: true, data: await getSettingsLanguages(supabase, tenantId) }, 200, 'public, max-age=300');
        case '': case undefined:
          return jsonResponse({ success: true, data: await getConfig(supabase, tenantId, { locale }) }, 200, 'public, max-age=300');
        default: return errorResponse('Settings endpoint not found', 404);
      }
    }

    // ---- SEARCH ----
    if (resource === 'search') {
      if (method !== 'GET') return errorResponse('Method not allowed', 405);
      const params: Record<string, unknown> = {
        query: sp.get('q') || '', locale, limit: sp.get('limit') || 20,
        autocomplete: sp.get('autocomplete') === 'true',
      };
      return jsonResponse({ success: true, data: await searchProducts(supabase, tenantId, params) }, 200, 'public, max-age=30');
    }

    // ---- LEGAL PAGES ----
    if (resource === 'legal') {
      if (method !== 'GET') return errorResponse('Method not allowed', 405);
      const langField = locale && ['en', 'de', 'fr'].includes(locale) ? locale : 'nl';
      const { data: legalPages, error: legalErr } = await supabase
        .from('legal_pages')
        .select(`id, page_type, title_nl, title_en, title_de, title_fr, content_nl, content_en, content_de, content_fr, is_published`)
        .eq('tenant_id', tenantId)
        .eq('is_published', true);
      if (legalErr) throw legalErr;

      if (resourceId) {
        // Single page by type: GET /legal/privacy
        const page = (legalPages || []).find((p: any) => p.page_type === resourceId);
        if (!page) return errorResponse('Legal page not found', 404);
        return jsonResponse({ success: true, data: {
          type: page.page_type,
          title: page[`title_${langField}`] || page.title_nl || page.page_type,
          slug: page.page_type,
          content: page[`content_${langField}`] || page.content_nl || '',
        }}, 200, 'public, max-age=600');
      }

      // List all published legal pages
      const slugMap: Record<string, string> = {
        privacy: 'privacy', terms: 'terms', refund: 'returns',
        shipping: 'shipping', contact: 'contact', legal_notice: 'legal-notice', cookie: 'cookies',
      };
      return jsonResponse({ success: true, data: (legalPages || []).map((p: any) => ({
        type: p.page_type,
        title: p[`title_${langField}`] || p.title_nl || p.page_type,
        slug: slugMap[p.page_type] || p.page_type,
        enabled: true,
      }))}, 200, 'public, max-age=600');
    }

    // ---- CONTACT FORM ----
    if (resource === 'contact' && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const { name, email, subject, message } = body;

      if (!name || !email || !message) {
        return errorResponse('Missing required fields: name, email, message', 400);
      }

      // Send via send-customer-message to tenant inbox
      const { error } = await supabase.functions.invoke('send-customer-message', {
        body: {
          tenant_id: tenantId,
          customer_email: email,
          customer_name: name,
          subject: subject || 'Contactformulier',
          body_html: `<p><strong>Naam:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Onderwerp:</strong> ${subject || 'Geen onderwerp'}</p><hr/><p>${message.replace(/\n/g, '<br/>')}</p>`,
          body_text: `Naam: ${name}\nEmail: ${email}\nOnderwerp: ${subject || 'Geen onderwerp'}\n\n${message}`,
          context_type: 'general',
          context_data: { source: 'storefront_contact_form' }
        }
      });

      if (error) {
        console.error('send-customer-message error:', error);
        return errorResponse('Failed to send message', 500);
      }

      return jsonResponse({ success: true, message: 'Message sent successfully' }, 200);
    }

    return errorResponse('Endpoint not found', 404, 'NOT_FOUND');

  } catch (error) {
    console.error('Storefront API error:', error);
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('not found') ? 404 : message.includes('required') ? 400 : 500;
    return new Response(JSON.stringify({ success: false, error: message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
  }
});
