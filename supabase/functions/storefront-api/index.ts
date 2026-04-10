import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    .select('id, name, slug, logo_url, primary_color, currency, country, tax_percentage, store_name, store_description, contact_email, contact_phone')
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
      vat_rate: tenant.tax_percentage || 21,
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
      bank_transfer_enabled: !!tenant.iban,
      bank_details: tenant.iban ? {
        account_holder: tenant.name || '',
        iban: tenant.iban || '',
        bic: tenant.bic || '',
      } : null,
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

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, name, slug, description, image_url, parent_id, sort_order, is_active, hide_from_storefront')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('hide_from_storefront', false)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  if (!categories || categories.length === 0) return [];

  // Get product counts per category (legacy + junction table)
  const { data: productCounts } = await supabase
    .from('products')
    .select('id, category_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('hide_from_storefront', false);

  const { data: junctionLinks } = await supabase
    .from('product_categories')
    .select('product_id, category_id');

  // Build a set of active product IDs for filtering junction links
  const activeProductIds = new Set((productCounts || []).map((p: any) => p.id));

  const countMap: Record<string, Set<string>> = {};
  if (productCounts) {
    for (const p of productCounts) {
      if (p.category_id) {
        if (!countMap[p.category_id]) countMap[p.category_id] = new Set();
        countMap[p.category_id].add(p.id);
      }
    }
  }
  // Add junction-tabel counts (only for active, visible products)
  if (junctionLinks) {
    for (const jl of junctionLinks) {
      if (activeProductIds.has(jl.product_id)) {
        if (!countMap[jl.category_id]) countMap[jl.category_id] = new Set();
        countMap[jl.category_id].add(jl.product_id);
      }
    }
  }

  // Translations
  const tMap = locale ? await getTranslations(supabase, tenantId, 'category', categories.map((c: any) => c.id), locale) : {};

  return categories.map((cat: any) => {
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

  // Related products (same categories via legacy + junction table, max 8)
  let relatedProducts: any[] = [];
  {
    // Get all category IDs for this product (legacy + junction)
    const productCategoryIds: string[] = [];
    if (product.category_id) productCategoryIds.push(product.category_id);
    
    const { data: junctionCats } = await supabase
      .from('product_categories')
      .select('category_id')
      .eq('product_id', product.id);
    
    if (junctionCats) {
      for (const jc of junctionCats) {
        if (!productCategoryIds.includes(jc.category_id)) {
          productCategoryIds.push(jc.category_id);
        }
      }
    }

    let relatedQuery = supabase
      .from('products')
      .select('id, name, slug, price, compare_at_price, images, featured_image')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('hide_from_storefront', false)
      .neq('id', product.id)
      .limit(8);

    if (productCategoryIds.length > 0) {
      // Get product IDs from junction table that share any of these categories
      const { data: junctionRelated } = await supabase
        .from('product_categories')
        .select('product_id')
        .in('category_id', productCategoryIds);
      
      const junctionRelatedIds = (junctionRelated || []).map((jr: any) => jr.product_id).filter((id: string) => id !== product.id);
      
      if (junctionRelatedIds.length > 0) {
        const categoryFilter = productCategoryIds.map(cid => `category_id.eq.${cid}`).join(',');
        relatedQuery = relatedQuery.or(`${categoryFilter},id.in.(${junctionRelatedIds.join(',')})`);
      } else {
        const categoryFilter = productCategoryIds.map(cid => `category_id.eq.${cid}`).join(',');
        relatedQuery = relatedQuery.or(categoryFilter);
      }
    }

    const { data: related } = await relatedQuery;

    if (related && locale) {
      const relTMap = await getTranslations(supabase, tenantId, 'product', related.map((r: any) => r.id), locale);
      relatedProducts = related.map((r: any) => {
        const rt = relTMap[r.id] || {};
        return { id: r.id, name: rt.name || r.name, slug: r.slug, price: r.price, compare_at_price: r.compare_at_price, image: r.featured_image || r.images?.[0] || null };
      });
    } else {
      relatedProducts = (related || []).map((r: any) => ({
        id: r.id, name: r.name, slug: r.slug, price: r.price, compare_at_price: r.compare_at_price, image: r.featured_image || r.images?.[0] || null,
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

  // Fetch bundle data if product is a bundle (via product_bundle_items)
  let bundleData: Record<string, unknown> = {};
  if (product.product_type === 'bundle') {
    const { data: bundleItems } = await supabase
      .from('product_bundle_items')
      .select('id, quantity, customer_can_adjust, min_quantity, max_quantity, sort_order, child_product_id, products!product_bundle_items_child_product_id_fkey(id, name, slug, price, images, track_inventory, stock)')
      .eq('product_id', product.id)
      .order('sort_order', { ascending: true });

    const items = (bundleItems || []).map((bi: any) => ({
      id: bi.id,
      product_id: bi.child_product_id,
      quantity: bi.quantity,
      customer_can_adjust: bi.customer_can_adjust,
      min_quantity: bi.min_quantity,
      max_quantity: bi.max_quantity,
      sort_order: bi.sort_order,
      product: bi.products ? {
        id: bi.products.id,
        name: bi.products.name,
        slug: bi.products.slug,
        price: bi.products.price,
        image: bi.products.images?.[0] || null,
        in_stock: !bi.products.track_inventory || bi.products.stock > 0,
      } : null,
    }));

    const individualTotal = items.reduce((s: number, bi: any) => s + (bi.product?.price || 0) * bi.quantity, 0);

    bundleData = {
      bundle_items: items,
      bundle_individual_total: individualTotal,
      bundle_savings: individualTotal > product.price ? individualTotal - product.price : 0,
      bundle_pricing_model: product.bundle_pricing_model || 'fixed',
    };
  }

  return {
    id: product.id,
    name: t.name || product.name,
    slug: product.slug,
    description: t.description || product.description,
    short_description: t.short_description || product.short_description || null,
    price: product.price,
    compare_at_price: product.compare_at_price,
    images: (() => { const fi = product.featured_image || (product.images?.[0] || null); return fi ? [fi, ...(product.images || []).filter((i: string) => i !== fi)] : (product.images || []); })(),
    featured_image: product.featured_image || (product.images?.[0] || null),
    sku: product.sku,
    barcode: product.barcode || null,
    weight: product.weight || null,
    product_type: product.product_type || 'physical',
    in_stock: hasVariants ? (variants || []).some((v: any) => !v.track_inventory || v.stock > 0) : (!product.track_inventory || product.stock > 0),
    stock: product.track_inventory ? product.stock : null,
    tags: product.tags || [],
    category: product.categories ? { id: product.categories.id, name: product.categories.name, slug: product.categories.slug } : null,
    has_variants: hasVariants,
    is_variant_product: isVariantProduct,
    parent_product_id: isVariantProduct ? product.parent_product_id : null,
    selected_variant_index: selectedVariantIndex,
    variants: (variants || []).map((v: any) => ({
      id: v.id, title: v.title, sku: v.sku, barcode: v.barcode,
      price: v.price ?? product.price, compare_at_price: v.compare_at_price ?? product.compare_at_price,
      stock: v.track_inventory ? v.stock : null,
      in_stock: !v.track_inventory || v.stock > 0,
      image_url: v.image_url, attribute_values: v.attribute_values, weight: v.weight ?? product.weight,
      linked_product_id: v.linked_product_id || null,
      linked_product_slug: v.linked_product_id ? (linkedProductSlugs[v.linked_product_id] || null) : null,
    })),
    options: (variantOptions || []).map((o: any) => ({ id: o.id, name: o.name, values: o.values, position: o.position })),
    ...bundleData,
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
    ...bundleData,
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
    .select('id, name, slug, description, price, compare_at_price, images, featured_image, is_active, hide_from_storefront, track_inventory, stock, sku, category_id, tags, is_featured, product_type, bundle_pricing_model, bundle_discount_value, created_at, categories(id, name, slug, hide_from_storefront)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('hide_from_storefront', false);

  if (resolvedCategoryId) {
    // Also include products linked via junction table (non-primary categories)
    const { data: junctionProducts } = await supabase
      .from('product_categories')
      .select('product_id')
      .eq('category_id', resolvedCategoryId);
    
    const junctionIds = (junctionProducts || []).map((jp: any) => jp.product_id);
    
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

  // Fetch bundle items for bundle products with dynamic pricing
  const bundleProductIds = filtered
    .filter((p: any) => p.product_type === 'bundle' && p.bundle_pricing_model === 'dynamic')
    .map((p: any) => p.id);
  let bundlePriceMap: Record<string, { calculated_price: number; individual_total: number; savings: number }> = {};
  if (bundleProductIds.length > 0) {
    const { data: bundleItems } = await supabase
      .from('product_bundle_items')
      .select('product_id, quantity, child_product:products!product_bundle_items_child_product_id_fkey(price)')
      .in('product_id', bundleProductIds);
    if (bundleItems) {
      const grouped: Record<string, any[]> = {};
      for (const bi of bundleItems) {
        if (!grouped[bi.product_id]) grouped[bi.product_id] = [];
        grouped[bi.product_id].push(bi);
      }
      for (const pid of bundleProductIds) {
        const items = grouped[pid] || [];
        const individualTotal = items.reduce((sum: number, item: any) => {
          const childPrice = item.child_product?.price || 0;
          return sum + childPrice * (item.quantity || 1);
        }, 0);
        const parentProduct = filtered.find((p: any) => p.id === pid);
        const discountValue = parentProduct?.bundle_discount_value || 0;
        const calculatedPrice = Math.max(0, individualTotal - discountValue);
        bundlePriceMap[pid] = {
          calculated_price: calculatedPrice,
          individual_total: individualTotal,
          savings: individualTotal - calculatedPrice,
        };
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
      const bundlePrice = bundlePriceMap[product.id] || null;
      const effectivePrice = bundlePrice ? bundlePrice.calculated_price : product.price;
      return {
        id: product.id, name: t.name || product.name, slug: product.slug,
        description: t.description || product.description,
        price: effectivePrice, compare_at_price: product.compare_at_price,
        images: (() => { const fi = product.featured_image || (product.images?.[0] || null); return fi ? [fi, ...(product.images || []).filter((i: string) => i !== fi)] : (product.images || []); })(),
        featured_image: product.featured_image || (product.images && product.images.length > 0 ? product.images[0] : null),
        product_type: product.product_type || 'physical',
        bundle_pricing_model: product.bundle_pricing_model || null,
        bundle_calculated_price: bundlePrice?.calculated_price || null,
        bundle_individual_total: bundlePrice?.individual_total || null,
        bundle_savings: bundlePrice?.savings || null,
        in_stock: hasVariants
          ? pVariants.some((v: any) => !v.track_inventory || v.stock > 0)
          : (!product.track_inventory || product.stock > 0),
        stock: product.track_inventory ? product.stock : null, sku: product.sku,
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
    .select('id, name, slug, price, compare_at_price, images, featured_image, sku, tags, description')
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
    return { results: sorted.map((p: any) => ({ id: p.id, name: p.name, slug: p.slug, image: p.featured_image || p.images?.[0] || null, price: p.price })) };
  }

  const tMap = locale ? await getTranslations(supabase, tenantId, 'product', sorted.map((p: any) => p.id), locale) : {};
  return {
    results: sorted.map((p: any) => {
      const t = tMap[p.id] || {};
      return {
        id: p.id, name: t.name || p.name, slug: p.slug, price: p.price, compare_at_price: p.compare_at_price,
        image: p.featured_image || p.images?.[0] || null, sku: p.sku,
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
  return { valid: true, discount_type: data.discount_type, discount_value: data.discount_value, applies_to: data.applies_to, description: data.description, max_discount_amount: data.maximum_discount_amount || null, discount_code_id: data.id };
}

// ============== CART ACTIONS ==============

async function cartCreate(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const sessionId = params.session_id as string;
  const currency = (params.currency as string) || 'EUR';
  if (!sessionId) throw new Error('session_id is required');

  // Check for existing cart
  const { data: existing } = await supabase
    .from('storefront_carts').select('id')
    .eq('tenant_id', tenantId).eq('session_id', sessionId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing) return { cart_id: existing.id };

  const { data, error } = await supabase
    .from('storefront_carts')
    .insert({ tenant_id: tenantId, session_id: sessionId, currency })
    .select('id').single();
  if (error) throw error;
  return { cart_id: data.id };
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
    .select('id, product_id, variant_id, quantity, unit_price, products(id, name, slug, images, price, track_inventory, stock)')
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
    return {
      id: item.id, product_id: item.product_id, variant_id: item.variant_id || null,
      quantity: item.quantity, unit_price: item.unit_price,
      product: item.products ? { name: item.products.name, slug: item.products.slug, image: variant?.image_url || item.products.images?.[0] || null, current_price: item.products.price, in_stock: !item.products.track_inventory || item.products.stock > 0 } : null,
      variant: variant ? { title: variant.title, attribute_values: variant.attribute_values, image_url: variant.image_url } : null,
      line_total: item.quantity * item.unit_price,
    };
  });

  const subtotal = cartItems.reduce((s: number, i: any) => s + i.line_total, 0);

  return {
    id: cart.id, session_id: cart.session_id, currency: cart.currency, discount_code: cart.discount_code,
    items: cartItems, item_count: cartItems.reduce((s: number, i: any) => s + i.quantity, 0),
    subtotal, expires_at: cart.expires_at,
  };
}

async function cartAddItem(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const cartId = params.cart_id as string;
  const productId = params.product_id as string;
  const variantId = params.variant_id as string | undefined;
  const quantity = Math.max(1, Number(params.quantity) || 1);
  if (!cartId || !productId) throw new Error('cart_id and product_id are required');

  // Verify product exists and get price
  const { data: product } = await supabase
    .from('products').select('id, price, track_inventory, stock, is_active')
    .eq('id', productId).eq('tenant_id', tenantId).single();
  if (!product || !product.is_active) throw new Error('Product not found or inactive');

  let unitPrice = product.price;
  let stockSource = product;

  // If variant_id provided, validate and use variant pricing/stock
  if (variantId) {
    const { data: variant } = await supabase
      .from('product_variants').select('id, price, stock, track_inventory, is_active')
      .eq('id', variantId).eq('product_id', productId).eq('tenant_id', tenantId).single();
    if (!variant || !variant.is_active) throw new Error('Variant not found or inactive');
    unitPrice = variant.price ?? product.price;
    stockSource = variant;
  }

  if (stockSource.track_inventory && stockSource.stock < quantity) throw new Error('Insufficient stock');

  // Check if item already in cart (unique by product_id + variant_id)
  let existingQuery = supabase.from('storefront_cart_items').select('id, quantity').eq('cart_id', cartId).eq('product_id', productId);
  if (variantId) existingQuery = existingQuery.eq('variant_id', variantId);
  else existingQuery = existingQuery.is('variant_id', null);
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    const newQty = existing.quantity + quantity;
    if (stockSource.track_inventory && stockSource.stock < newQty) throw new Error('Insufficient stock');
    const { error } = await supabase.from('storefront_cart_items').update({ quantity: newQty, unit_price: unitPrice }).eq('id', existing.id);
    if (error) throw error;
  } else {
    const insertData: any = { cart_id: cartId, product_id: productId, quantity, unit_price: unitPrice };
    if (variantId) insertData.variant_id = variantId;
    const { error } = await supabase.from('storefront_cart_items').insert(insertData);
    if (error) throw error;
  }

  await supabase.from('storefront_carts').update({ updated_at: new Date().toISOString() }).eq('id', cartId);
  return cartGet(supabase, tenantId, { cart_id: cartId });
}

async function cartUpdateItem(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const itemId = params.item_id as string;
  const quantity = Number(params.quantity);
  if (!itemId) throw new Error('item_id is required');
  if (quantity < 1) throw new Error('quantity must be at least 1');

  const { data: item } = await supabase.from('storefront_cart_items').select('id, cart_id, product_id').eq('id', itemId).single();
  if (!item) throw new Error('Cart item not found');

  // Stock check
  const { data: product } = await supabase.from('products').select('track_inventory, stock').eq('id', item.product_id).single();
  if (product?.track_inventory && product.stock < quantity) throw new Error('Insufficient stock');

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

  const { error } = await supabase.from('storefront_carts').update({ discount_code: code, updated_at: new Date().toISOString() }).eq('id', cartId);
  if (error) throw error;
  return cartGet(supabase, tenantId, { cart_id: cartId });
}

async function cartRemoveDiscount(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const cartId = params.cart_id as string;
  if (!cartId) throw new Error('cart_id is required');
  const { error } = await supabase.from('storefront_carts').update({ discount_code: null, updated_at: new Date().toISOString() }).eq('id', cartId);
  if (error) throw error;
  return cartGet(supabase, tenantId, { cart_id: cartId });
}

// ============== CHECKOUT ACTIONS (Cart-based, no early order creation) ==============

function deriveCartCheckoutStatus(cart: any): string {
  if (cart.checkout_status === 'converted') return 'converted';
  if (cart.payment_method) return 'payment_selected';
  if (cart.shipping_method_id) return 'shipping_selected';
  if (cart.shipping_address) return 'address_saved';
  if (cart.customer_email) return 'customer_saved';
  if (cart.checkout_status === 'checkout') return 'checkout_started';
  return 'shopping';
}

async function getCartForCheckout(supabase: any, tenantId: string, cartId: string) {
  const { data: cart, error } = await supabase
    .from('storefront_carts').select('*')
    .eq('id', cartId).eq('tenant_id', tenantId).maybeSingle();
  if (error) throw error;
  if (!cart) return null;

  const { data: items } = await supabase
    .from('storefront_cart_items')
    .select('id, product_id, variant_id, quantity, unit_price, products(id, name, slug, images, price, sku, track_inventory, stock, category_id)')
    .eq('cart_id', cart.id);

  const variantIds = (items || []).filter((i: any) => i.variant_id).map((i: any) => i.variant_id);
  let variantMap: Record<string, any> = {};
  if (variantIds.length > 0) {
    const { data: variants } = await supabase.from('product_variants').select('id, title, image_url, attribute_values, price, stock, track_inventory, sku').in('id', variantIds);
    if (variants) variantMap = Object.fromEntries(variants.map((v: any) => [v.id, v]));
  }

  const cartItems = (items || []).map((item: any) => {
    const variant = item.variant_id ? variantMap[item.variant_id] : null;
    return {
      id: item.id, product_id: item.product_id, variant_id: item.variant_id || null,
      quantity: item.quantity, unit_price: item.unit_price,
      product: item.products ? { name: item.products.name, slug: item.products.slug, image: variant?.image_url || item.products.images?.[0] || null, sku: variant?.sku || item.products.sku || null, current_price: item.products.price, in_stock: !item.products.track_inventory || item.products.stock > 0, category_id: item.products.category_id } : null,
      variant: variant ? { title: variant.title, attribute_values: variant.attribute_values, image_url: variant.image_url } : null,
      line_total: item.quantity * item.unit_price,
    };
  });

  const subtotal = cartItems.reduce((s: number, i: any) => s + i.line_total, 0);
  return { ...cart, cartItems, subtotal };
}

async function createOrderFromCart(supabase: any, tenantId: string, cart: any, paymentStatus: string = 'pending', stripePaymentIntentId?: string, expiresAt?: string) {
  // Generate order number
  const { data: orderNumber } = await supabase.rpc('generate_order_number', { _tenant_id: tenantId });

  // Get tenant for VAT
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants').select('tax_percentage, currency, name, iban, bic')
    .eq('id', tenantId).single();
  if (tenantErr) console.error('Tenant query error in order creation:', tenantErr);

  const vatRate = tenant?.tax_percentage || 21;
  const subtotal = cart.subtotal;
  const shippingCost = Number(cart.shipping_cost) || 0;
  const discountAmount = Number(cart.discount_amount) || 0;
  const total = subtotal - discountAmount + shippingCost;
  const vatAmount = Math.round(subtotal * (vatRate / (100 + vatRate)) * 100) / 100;

  // Find or create customer
  let customerId: string | null = null;
  if (cart.customer_email) {
    const { data: existing } = await supabase
      .from('customers').select('id')
      .eq('tenant_id', tenantId).eq('email', cart.customer_email).maybeSingle();
    if (existing) {
      customerId = existing.id;
    } else {
      const { data: newCust } = await supabase
        .from('customers')
        .insert({
          tenant_id: tenantId, email: cart.customer_email,
          first_name: cart.customer_first_name || '', last_name: cart.customer_last_name || '',
          phone: cart.customer_phone || null, customer_type: 'consumer',
        })
        .select('id').single();
      customerId = newCust?.id || null;
    }
  }

  const orderStatus = paymentStatus === 'paid' ? 'processing' : 'pending';

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      order_number: orderNumber,
      status: orderStatus,
      payment_status: paymentStatus,
      payment_method: cart.payment_method || null,
      subtotal,
      tax_amount: vatAmount,
      shipping_cost: shippingCost,
      discount_amount: discountAmount,
      discount_code: cart.discount_code || null,
      total,
      customer_email: cart.customer_email,
      customer_name: `${cart.customer_first_name || ''} ${cart.customer_last_name || ''}`.trim(),
      customer_phone: cart.customer_phone || null,
      customer_id: customerId,
      shipping_address: cart.shipping_address || null,
      billing_address: cart.billing_address || cart.shipping_address || null,
      shipping_method_id: cart.shipping_method_id || null,
      currency: cart.currency || tenant?.currency || 'EUR',
      stripe_payment_intent_id: stripePaymentIntentId || null,
      expires_at: expiresAt || null,
    })
    .select('id, order_number, total, currency').single();
  if (orderError) throw orderError;

  // Create order items
  const orderItems = cart.cartItems.map((item: any) => ({
    order_id: order.id,
    product_id: item.product_id,
    product_name: item.product?.name || '',
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.line_total,
    product_sku: item.product?.sku || null,
    product_image: item.product?.image || null,
    variant_id: item.variant_id || null,
    variant_title: item.variant?.title || null,
  }));
  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) throw itemsError;

  // Mark cart as converted
  await supabase.from('storefront_carts').update({
    checkout_status: 'converted',
    updated_at: new Date().toISOString(),
  }).eq('id', cart.id);

  // Increment discount code usage
  if (cart.discount_code) {
    const { error: discountUsageError } = await supabase.rpc('increment_discount_usage', { _code: cart.discount_code, _tenant_id: tenantId });
    if (discountUsageError) {
      console.warn('Failed to increment discount usage for', cart.discount_code, discountUsageError.message);
    }
  }

  return order;
}

async function checkoutStart(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const cartId = params.cart_id as string;
  if (!cartId) return { success: false, error: { code: 'CART_NOT_FOUND', message: 'cart_id is required' } };

  const cart = await getCartForCheckout(supabase, tenantId, cartId);
  if (!cart || cart.cartItems.length === 0) return { success: false, error: { code: 'CART_EMPTY', message: 'Cart is empty' } };

  // Validate stock
  for (const item of cart.cartItems) {
    if (item.product && !item.product.in_stock) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: `${item.product.name} is niet meer op voorraad` } };
    }
  }

  // Mark cart as in checkout
  await supabase.from('storefront_carts').update({
    checkout_status: 'checkout',
    updated_at: new Date().toISOString(),
  }).eq('id', cartId);

  // Get available methods
  const [paymentMethods, shippingMethods] = await Promise.all([
    checkoutGetPaymentMethods(supabase, tenantId),
    checkoutGetShippingOptions(supabase, tenantId, { subtotal: cart.subtotal }),
  ]);

  const items = cart.cartItems.map((item: any) => ({
    id: item.id,
    product_id: item.product_id,
    variant_id: item.variant_id,
    product_name: item.product?.name || '',
    variant_name: item.variant?.title || null,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
    image: item.product?.image || null,
  }));

  return {
    cart_id: cartId,
    status: 'checkout_started',
    items,
    subtotal: cart.subtotal,
    currency: cart.currency || 'EUR',
    requires_shipping: shippingMethods.length > 0,
    available_payment_methods: paymentMethods,
    available_shipping_methods: shippingMethods,
  };
}

async function checkoutCustomer(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const cartId = params.cart_id as string;
  const customer = params.customer as any;
  if (!cartId) return { success: false, error: { code: 'CART_NOT_FOUND', message: 'cart_id is required' } };
  if (!customer?.email) return { success: false, error: { code: 'VALIDATION_ERROR', message: 'E-mailadres is verplicht', fields: { email: 'E-mailadres is verplicht' } } };
  if (!customer?.first_name) return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Voornaam is verplicht', fields: { first_name: 'Voornaam is verplicht' } } };
  if (!customer?.last_name) return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Achternaam is verplicht', fields: { last_name: 'Achternaam is verplicht' } } };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customer.email)) return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Ongeldig e-mailadres', fields: { email: 'Ongeldig e-mailadres' } } };

  const { error } = await supabase.from('storefront_carts').update({
    customer_email: customer.email,
    customer_first_name: customer.first_name,
    customer_last_name: customer.last_name,
    customer_phone: customer.phone || null,
    checkout_status: 'checkout',
    updated_at: new Date().toISOString(),
  }).eq('id', cartId).eq('tenant_id', tenantId);
  if (error) throw error;

  return { cart_id: cartId, status: 'customer_saved' };
}

async function checkoutAddress(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const cartId = params.cart_id as string;
  const shippingAddress = params.shipping_address as any;
  const billingSameAsShipping = params.billing_same_as_shipping !== false;
  const billingAddress = billingSameAsShipping ? shippingAddress : (params.billing_address as any);

  if (!cartId) return { success: false, error: { code: 'CART_NOT_FOUND', message: 'cart_id is required' } };
  if (!shippingAddress?.street || !shippingAddress?.city || !shippingAddress?.postal_code || !shippingAddress?.country) {
    return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Onvolledig adres', fields: { shipping_address: 'Straat, stad, postcode en land zijn verplicht' } } };
  }

  const { error } = await supabase.from('storefront_carts').update({
    shipping_address: shippingAddress,
    billing_address: billingAddress || shippingAddress,
    billing_same_as_shipping: billingSameAsShipping,
    updated_at: new Date().toISOString(),
  }).eq('id', cartId).eq('tenant_id', tenantId);
  if (error) throw error;

  return { cart_id: cartId, status: 'address_saved' };
}

async function checkoutShipping(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const cartId = params.cart_id as string;
  const shippingMethodId = params.shipping_method_id as string;
  if (!cartId) return { success: false, error: { code: 'CART_NOT_FOUND', message: 'cart_id is required' } };
  if (!shippingMethodId) return { success: false, error: { code: 'SHIPPING_NOT_AVAILABLE', message: 'shipping_method_id is required' } };

  const { data: method } = await supabase
    .from('shipping_methods').select('id, name, price, free_above')
    .eq('id', shippingMethodId).eq('tenant_id', tenantId).single();
  if (!method) return { success: false, error: { code: 'SHIPPING_NOT_AVAILABLE', message: 'Verzendmethode niet gevonden' } };

  const cart = await getCartForCheckout(supabase, tenantId, cartId);
  if (!cart) return { success: false, error: { code: 'CART_NOT_FOUND', message: 'Cart niet gevonden' } };

  const shippingCost = method.free_above && cart.subtotal >= method.free_above ? 0 : method.price;
  const discountAmount = Number(cart.discount_amount) || 0;
  const total = cart.subtotal - discountAmount + shippingCost;

  const { error } = await supabase.from('storefront_carts').update({
    shipping_method_id: shippingMethodId,
    shipping_cost: shippingCost,
    updated_at: new Date().toISOString(),
  }).eq('id', cartId).eq('tenant_id', tenantId);
  if (error) throw error;

  return { cart_id: cartId, status: 'shipping_selected', shipping_cost: shippingCost, subtotal: cart.subtotal, total };
}

async function checkoutComplete(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const cartId = params.cart_id as string;
  const paymentMethodId = params.payment_method_id as string || params.payment_method as string;
  const successUrl = params.success_url as string;
  const cancelUrl = params.cancel_url as string;

  if (!cartId) return { success: false, error: { code: 'CART_NOT_FOUND', message: 'cart_id is required' } };
  if (!paymentMethodId) return { success: false, error: { code: 'PAYMENT_METHOD_NOT_AVAILABLE', message: 'payment_method_id is required' } };

  // Get full cart with items
  const cart = await getCartForCheckout(supabase, tenantId, cartId);
  if (!cart) return { success: false, error: { code: 'CART_NOT_FOUND', message: 'Cart niet gevonden' } };
  if (cart.checkout_status === 'converted') return { success: false, error: { code: 'ORDER_ALREADY_PAID', message: 'Deze bestelling is al afgerond' } };
  if (cart.cartItems.length === 0) return { success: false, error: { code: 'CART_EMPTY', message: 'Cart is leeg' } };

  // Validate required fields
  if (!cart.customer_email) {
    return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Klantgegevens zijn nog niet ingevuld' } };
  }

  // Save payment method on cart
  await supabase.from('storefront_carts').update({
    payment_method: paymentMethodId,
    updated_at: new Date().toISOString(),
  }).eq('id', cartId);
  cart.payment_method = paymentMethodId;

  // Get tenant info
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants').select('tax_percentage, stripe_account_id, iban, bic, name, currency')
    .eq('id', tenantId).single();

  if (tenantError || !tenantData) {
    console.error('checkoutComplete tenant query failed:', tenantError);
    return { success: false, error: { code: 'TENANT_CONFIG_ERROR', message: 'Winkelconfiguratie voor betaling kon niet geladen worden' } };
  }

  const shippingCost = Number(cart.shipping_cost) || 0;
  const discountAmount = Number(cart.discount_amount) || 0;
  const total = cart.subtotal - discountAmount + shippingCost;
  const currency = cart.currency || tenantData?.currency || 'EUR';

  if (paymentMethodId === 'stripe' && tenantData?.stripe_account_id) {
    if (!successUrl || !cancelUrl) return { success: false, error: { code: 'VALIDATION_ERROR', message: 'success_url en cancel_url zijn verplicht voor Stripe' } };

    const Stripe = (await import("https://esm.sh/stripe@14.21.0")).default;
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2023-10-16' });

    const lineItems = cart.cartItems.map((item: any) => ({
      price_data: {
        currency: currency.toLowerCase(),
        product_data: { name: item.product?.name || 'Product' },
        unit_amount: Math.round(item.unit_price * 100),
      },
      quantity: item.quantity,
    }));

    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: { name: 'Verzending' },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      });
    }

    // Build session params
    const sessionParams: any = {
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: cart.customer_email,
      metadata: { cart_id: cartId, tenant_id: tenantId },
      payment_intent_data: {
        application_fee_amount: 0,
        transfer_data: { destination: tenantData.stripe_account_id },
      },
    };

    // Apply discount by reducing line item amounts proportionally (coupons incompatible with destination charges)
    if (discountAmount > 0) {
      const productItems = lineItems.filter(
        (li: any) => li.price_data.product_data.name !== 'Verzending'
      );
      const subtotalCents = productItems.reduce(
        (sum: number, li: any) => sum + li.price_data.unit_amount * li.quantity, 0
      );
      const discountCents = Math.min(Math.round(discountAmount * 100), subtotalCents);
      let remaining = discountCents;

      productItems.forEach((li: any, i: number) => {
        const itemTotal = li.price_data.unit_amount * li.quantity;
        const itemDiscount = i === productItems.length - 1
          ? remaining
          : Math.round((itemTotal / subtotalCents) * discountCents);
        const perUnitDiscount = Math.round(itemDiscount / li.quantity);
        li.price_data.unit_amount = Math.max(0, li.price_data.unit_amount - perUnitDiscount);
        remaining -= perUnitDiscount * li.quantity;
      });
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Save stripe session id on cart
    await supabase.from('storefront_carts').update({
      stripe_session_id: session.id,
    }).eq('id', cartId);

    return {
      cart_id: cartId,
      status: 'payment_pending',
      payment_type: 'redirect',
      checkout_url: session.url,
    };
  }

  // For bank_transfer: create order with awaiting_payment status
  if (paymentMethodId === 'bank_transfer') {
    // Decrement stock (reservation)
    for (const item of cart.cartItems) {
      if (item.variant_id) {
        const { error: vsErr } = await supabase.rpc('decrement_variant_stock', { p_variant_id: item.variant_id, p_quantity: item.quantity });
        if (vsErr) console.warn('decrement_variant_stock failed:', vsErr.message);
      } else if (item.product_id) {
        const { error: sErr } = await supabase.rpc('decrement_stock', { p_product_id: item.product_id, p_quantity: item.quantity });
        if (sErr) console.warn('decrement_stock failed:', sErr.message);
      }
    }

    // Set expiry 7 days from now for unpaid bank transfer orders
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const order = await createOrderFromCart(supabase, tenantId, cart, 'pending', undefined, expiresAt);

    // Generate invoice (best-effort)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: JSON.stringify({ order_id: order.id }),
      }).catch(() => {});
    } catch {}

    // Build EPC QR code payload with BIC and structured reference
    const iban = tenantData?.iban || '';
    const bic = tenantData?.bic || '';
    const name = tenantData?.name || '';
    const amount = order.total.toFixed(2);
    const ref = order.order_number;
    console.log('QR EPC payload data:', { iban, bic, name, amount, ref });
    const qrPayload = [
      "BCD",                            // 1: Service Tag
      "002",                            // 2: Version
      "1",                              // 3: UTF-8
      "SCT",                            // 4: SEPA Credit Transfer
      bic,                              // 5: BIC
      name,                             // 6: Beneficiary Name
      iban.replace(/\s/g, ''),          // 7: IBAN zonder spaties
      `EUR${Number(amount).toFixed(2)}`,// 8: Amount
      "",                               // 9: Purpose (leeg)
      "",                               // 10: Structured Reference (leeg)
      ref,                              // 11: Unstructured Remittance (bestelnummer)
      "",                               // 12: Display text (leeg)
    ].join("\n");

    return {
      order_id: order.id,
      order_number: order.order_number,
      status: 'awaiting_payment',
      payment_type: 'qr',
      total: order.total,
      currency,
      bank_details: {
        account_holder: name,
        iban,
        bic,
        reference: ref,
      },
      qr_data: {
        payload: qrPayload,
        image_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`,
      },
    };
  }

  return { success: false, error: { code: 'PAYMENT_METHOD_NOT_AVAILABLE', message: 'Onbekende betaalmethode' } };
}

async function checkoutGetOrder(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const orderId = params.order_id as string;
  const cartId = params.cart_id as string;

  // If cart_id provided, return cart checkout state
  if (cartId) {
    const cart = await getCartForCheckout(supabase, tenantId, cartId);
    if (!cart) return { success: false, error: { code: 'CART_NOT_FOUND', message: 'Cart niet gevonden' } };

    return {
      cart_id: cartId,
      status: deriveCartCheckoutStatus(cart),
      items: cart.cartItems.map((item: any) => ({
        id: item.id, product_id: item.product_id, product_name: item.product?.name || '', product_sku: item.product?.sku || null,
        product_image: item.product?.image || null, quantity: item.quantity, unit_price: item.unit_price, total_price: item.line_total,
        variant_id: item.variant_id, variant_title: item.variant?.title || null,
      })),
      customer: cart.customer_email ? {
        email: cart.customer_email,
        name: `${cart.customer_first_name || ''} ${cart.customer_last_name || ''}`.trim(),
        phone: cart.customer_phone,
      } : null,
      shipping_address: cart.shipping_address,
      billing_address: cart.billing_address,
      payment_method: cart.payment_method,
      subtotal: cart.subtotal,
      shipping_cost: Number(cart.shipping_cost) || 0,
      discount: Number(cart.discount_amount) || 0,
      discount_code: cart.discount_code,
      total: cart.subtotal - (Number(cart.discount_amount) || 0) + (Number(cart.shipping_cost) || 0),
      currency: cart.currency || 'EUR',
    };
  }

  // Order-based lookup (post-payment)
  if (!orderId) return { success: false, error: { code: 'ORDER_NOT_FOUND', message: 'order_id or cart_id is required' } };

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, order_number, status, payment_status, payment_method, subtotal, shipping_cost, tax_amount, discount_amount, total, currency, shipping_address, billing_address, customer_email, customer_name, customer_phone, shipping_method_id, created_at')
    .eq('id', orderId).eq('tenant_id', tenantId).single();
  if (error || !order) return { success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Order niet gevonden' } };

  const { data: items } = await supabase
    .from('order_items')
    .select('id, product_id, product_name, product_sku, product_image, quantity, unit_price, total_price, variant_id, variant_title')
    .eq('order_id', orderId);

  let shippingMethod = null;
  if (order.shipping_method_id) {
    const { data: sm } = await supabase.from('shipping_methods').select('id, name, price').eq('id', order.shipping_method_id).single();
    shippingMethod = sm;
  }

  return {
    order_id: order.id,
    order_number: order.order_number,
    status: order.status,
    payment_status: order.payment_status,
    items: items || [],
    customer: {
      email: order.customer_email,
      name: order.customer_name,
      phone: order.customer_phone,
    },
    shipping_address: order.shipping_address,
    billing_address: order.billing_address,
    shipping_method: shippingMethod,
    payment_method: order.payment_method,
    subtotal: order.subtotal,
    shipping_cost: order.shipping_cost,
    discount: order.discount_amount,
    total: order.total,
    currency: order.currency,
  };
}

async function checkoutApplyDiscount(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const cartId = params.cart_id as string;
  const discountCode = params.discount_code as string;
  if (!cartId || !discountCode) return { success: false, error: { code: 'DISCOUNT_INVALID', message: 'cart_id en discount_code zijn verplicht' } };

  const cart = await getCartForCheckout(supabase, tenantId, cartId);
  if (!cart) return { success: false, error: { code: 'CART_NOT_FOUND', message: 'Cart niet gevonden' } };

  const validation = await validateDiscountCode(supabase, tenantId, { code: discountCode, subtotal: cart.subtotal });
  if (!validation.valid) return { success: false, error: { code: 'DISCOUNT_INVALID', message: validation.error || 'Ongeldige kortingscode' } };

  const discountAmount = calculateDiscountValue(cart.subtotal, validation.discount_type, validation.discount_value, validation.max_discount_amount);
  const shippingCost = Number(cart.shipping_cost) || 0;
  const total = cart.subtotal - discountAmount + shippingCost;

  await supabase.from('storefront_carts').update({
    discount_code: discountCode,
    discount_amount: discountAmount,
    updated_at: new Date().toISOString(),
  }).eq('id', cartId);

  return {
    cart_id: cartId,
    discount_code: discountCode,
    discount_type: validation.discount_type,
    discount_value: validation.discount_value,
    discount_amount: discountAmount,
    subtotal: cart.subtotal,
    shipping_cost: shippingCost,
    total,
  };
}

async function checkoutRemoveDiscount(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const cartId = params.cart_id as string;
  if (!cartId) return { success: false, error: { code: 'CART_NOT_FOUND', message: 'cart_id is required' } };

  const cart = await getCartForCheckout(supabase, tenantId, cartId);
  if (!cart) return { success: false, error: { code: 'CART_NOT_FOUND', message: 'Cart niet gevonden' } };

  const shippingCost = Number(cart.shipping_cost) || 0;
  const total = cart.subtotal + shippingCost;

  await supabase.from('storefront_carts').update({
    discount_code: null, discount_amount: 0,
    updated_at: new Date().toISOString(),
  }).eq('id', cartId);

  return { cart_id: cartId, subtotal: cart.subtotal, shipping_cost: shippingCost, total };
}

// Legacy compatibility wrappers

async function checkoutSetAddresses(supabase: any, tenantId: string, params: Record<string, unknown>) {
  // If cart_id present, route to new flow
  if (params.cart_id) {
    if (params.email) {
      await checkoutCustomer(supabase, tenantId, {
        cart_id: params.cart_id,
        customer: { email: params.email, first_name: (params.shipping_address as any)?.first_name, last_name: (params.shipping_address as any)?.last_name, phone: params.phone },
      });
    }
    return checkoutAddress(supabase, tenantId, {
      cart_id: params.cart_id,
      shipping_address: params.shipping_address,
      billing_address: params.billing_address,
      billing_same_as_shipping: !params.billing_address,
    });
  }
  // Legacy stateless return
  const { shipping_address, billing_address, email, phone } = params as any;
  if (!shipping_address || !email) throw new Error('shipping_address and email are required');
  return { status: 'addresses_set', shipping_address, billing_address: billing_address || shipping_address, email, phone };
}

async function checkoutGetShippingOptions(supabase: any, tenantId: string, params: Record<string, unknown>) {
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
    .select('stripe_account_id, stripe_charges_enabled, iban, name')
    .eq('id', tenantId).single();

  const methods: any[] = [];
  if (tenant?.stripe_account_id && tenant?.stripe_charges_enabled) {
    methods.push({ id: 'stripe', name: 'Online betalen', description: 'iDEAL, creditcard, Bancontact', type: 'online' });
  }
  if (tenant?.iban) {
    methods.push({ id: 'bank_transfer', name: 'Bankoverschrijving', description: 'Betaal via overschrijving of scan de QR-code met je bankapp', type: 'manual' });
  }
  return methods;
}

async function checkoutPlaceOrder(supabase: any, tenantId: string, params: Record<string, unknown>) {
  // Legacy wrapper: runs full checkout in one call using cart
  const { cart_id, shipping_address, billing_address, email, phone, shipping_method_id, payment_method, customer_note, success_url, cancel_url } = params as any;

  if (!cart_id || !shipping_address || !email || !payment_method) {
    throw new Error('cart_id, shipping_address, email, and payment_method are required');
  }

  // Step 1: Start checkout
  const startResult = await checkoutStart(supabase, tenantId, { cart_id });
  if (startResult.error) throw new Error(startResult.error.message);

  // Step 2: Customer
  await checkoutCustomer(supabase, tenantId, {
    cart_id,
    customer: { email, first_name: shipping_address.first_name || '', last_name: shipping_address.last_name || '', phone },
  });

  // Step 3: Address
  await checkoutAddress(supabase, tenantId, {
    cart_id,
    shipping_address,
    billing_address,
    billing_same_as_shipping: !billing_address,
  });

  // Step 4: Shipping (optional)
  if (shipping_method_id) {
    await checkoutShipping(supabase, tenantId, { cart_id, shipping_method_id });
  }

  // Step 5: Notes on cart (will be on order after creation)
  // customer_note can be added after order is created

  // Step 6: Complete
  const completeResult = await checkoutComplete(supabase, tenantId, {
    cart_id,
    payment_method_id: payment_method,
    success_url: success_url || (params.origin ? `${params.origin}/order-confirmation` : undefined),
    cancel_url: cancel_url || (params.origin ? `${params.origin}/checkout?cancelled=true` : undefined),
  });

  // Add customer note if order was created (bank/qr)
  if (customer_note && completeResult.order_id) {
    await supabase.from('orders').update({ notes: customer_note }).eq('id', completeResult.order_id);
  }

  return {
    order_id: completeResult.order_id || null,
    order_number: completeResult.order_number || null,
    payment_url: completeResult.checkout_url || null,
    payment_method: payment_method,
    total: completeResult.total,
  };
}

async function checkoutCreateSession(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const { success_url, cancel_url } = params as any;
  if (!success_url || !cancel_url) throw new Error('success_url and cancel_url are required');

  const result = await checkoutPlaceOrder(supabase, tenantId, params);
  return {
    order_id: result.order_id,
    order_number: result.order_number,
    checkout_url: result.payment_url || null,
    payment_method: result.payment_method,
    total: result.total,
  };
}

async function checkoutGetConfirmation(supabase: any, tenantId: string, params: Record<string, unknown>) {
  return checkoutGetOrder(supabase, tenantId, params);
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
    .from('tenant_newsletter_config').select('provider, double_optin, welcome_email_enabled, welcome_email_subject, welcome_email_body, mailchimp_api_key, mailchimp_audience_id, mailchimp_server_prefix, klaviyo_api_key, klaviyo_list_id')
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

  // Send welcome email if enabled and not re-subscribing an existing active user
  if (config?.welcome_email_enabled && config?.welcome_email_body && !doubleOptin && existing?.status !== 'active') {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: 'tenant-welcome',
          recipientEmail: email,
          idempotencyKey: `welcome-newsletter-${tenantId}-${email}`,
          templateData: {
            subject: config.welcome_email_subject || 'Welkom bij onze nieuwsbrief!',
            body: config.welcome_email_body,
            firstName: firstName || '',
          },
        }),
      });
    } catch (e) {
      console.error('Welcome email send error (non-fatal):', e);
    }
  }

  return {
    message: doubleOptin ? 'Please check your email to confirm' : 'Successfully subscribed',
    provider, double_optin: doubleOptin,
  };
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

// ============== MAIN HANDLER ==============

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body: StorefrontRequest = await req.json();
    const { action, tenant_id, params = {} } = body;

    // Actions that don't need tenant_id
    if (action === 'resolve_domain') {
      return new Response(JSON.stringify({ success: true, data: await resolveDomain(supabase, params) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!tenant_id) {
      return new Response(JSON.stringify({ success: false, error: 'tenant_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Rate limiting per tenant
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
      // Cart actions
      case 'cart_create': result = await cartCreate(supabase, tenant_id, params); break;
      case 'cart_get': result = await cartGet(supabase, tenant_id, params); break;
      case 'cart_add_item': result = await cartAddItem(supabase, tenant_id, params); break;
      case 'cart_update_item': result = await cartUpdateItem(supabase, tenant_id, params); break;
      case 'cart_remove_item': result = await cartRemoveItem(supabase, tenant_id, params); break;
      case 'cart_apply_discount': result = await cartApplyDiscount(supabase, tenant_id, params); break;
      case 'cart_remove_discount': result = await cartRemoveDiscount(supabase, tenant_id, params); break;
      // Checkout actions (new stateful flow)
      case 'checkout_start': result = await checkoutStart(supabase, tenant_id, params); break;
      case 'checkout_customer': result = await checkoutCustomer(supabase, tenant_id, params); break;
      case 'checkout_address': result = await checkoutAddress(supabase, tenant_id, params); break;
      case 'checkout_shipping': result = await checkoutShipping(supabase, tenant_id, params); break;
      case 'checkout_complete': result = await checkoutComplete(supabase, tenant_id, params); break;
      case 'checkout_get_order': result = await checkoutGetOrder(supabase, tenant_id, params); break;
      case 'checkout_apply_discount': result = await checkoutApplyDiscount(supabase, tenant_id, params); break;
      case 'checkout_remove_discount': result = await checkoutRemoveDiscount(supabase, tenant_id, params); break;
      // Legacy checkout compat
      case 'checkout_set_addresses': result = await checkoutSetAddresses(supabase, tenant_id, params); break;
      case 'checkout_get_shipping_options': result = await checkoutGetShippingOptions(supabase, tenant_id, params); break;
      case 'checkout_get_payment_methods': result = await checkoutGetPaymentMethods(supabase, tenant_id); break;
      case 'checkout_place_order': result = await checkoutPlaceOrder(supabase, tenant_id, params); break;
      case 'checkout_create_session': result = await checkoutCreateSession(supabase, tenant_id, params); break;
      case 'checkout_get_confirmation': result = await checkoutGetConfirmation(supabase, tenant_id, params); break;
      case 'checkout_discount': result = await checkoutApplyDiscount(supabase, tenant_id, params); break;
      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const responseHeaders: Record<string, string> = { ...corsHeaders, 'Content-Type': 'application/json' };
    if (cacheControl) responseHeaders['Cache-Control'] = cacheControl;

    return new Response(JSON.stringify({ success: true, data: result }), { headers: responseHeaders });
  } catch (error) {
    console.error('Storefront API error:', error);
    const errMsg = error instanceof Error ? error.message : (typeof error === 'object' && error !== null && 'message' in error) ? (error as any).message : String(error);
    return new Response(JSON.stringify({ success: false, error: errMsg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
