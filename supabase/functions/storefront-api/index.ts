import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StorefrontRequest {
  action: 'get_tenant' | 'get_products' | 'get_shipping_methods' | 'get_service_points' | 'calculate_promotions' | 'validate_discount_code' | 'resolve_domain';
  tenant_id?: string;
  params?: Record<string, unknown>;
}

interface ServicePoint {
  id: string;
  name: string;
  carrier: string;
  type: 'pickup_point' | 'locker' | 'post_office';
  address: {
    street: string;
    house_number?: string;
    city: string;
    postal_code: string;
    country: string;
  };
  distance?: number;
  latitude?: number;
  longitude?: number;
  opening_hours?: Record<string, string>;
}

interface CartItem {
  product_id: string;
  product_name: string;
  sku?: string;
  price: number;
  quantity: number;
  category_id?: string | null;
  image_url?: string | null;
}

interface AppliedDiscount {
  type: string;
  name: string;
  value: number;
  source_id: string;
  description?: string;
}

interface CartGift {
  product_id: string;
  product_name: string;
  quantity: number;
  promotion_id: string;
  promotion_name: string;
  product_image?: string | null;
}

// ============== PROMOTION CALCULATION UTILITIES ==============

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

// ============== EXISTING FUNCTIONS ==============

async function getTenant(supabase: any, tenantId: string, params: Record<string, unknown> = {}) {
  const locale = params.locale as string | undefined;

  const { data, error } = await supabase
    .from('tenants')
    .select(`
      id, name, slug, logo_url, primary_color, currency, country, default_vat_rate,
      store_name, store_description, contact_email, contact_phone
    `)
    .eq('id', tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Tenant not found');

  let storeName = data.store_name || data.name;
  let storeDescription = data.store_description;

  // Apply locale translations if requested
  if (locale) {
    const { data: translations } = await supabase
      .from('content_translations')
      .select('field_name, translated_content')
      .eq('tenant_id', tenantId)
      .eq('entity_type', 'tenant')
      .eq('entity_id', tenantId)
      .eq('target_language', locale);

    if (translations) {
      for (const t of translations) {
        if (t.field_name === 'store_name' && t.translated_content) storeName = t.translated_content;
        if (t.field_name === 'store_description' && t.translated_content) storeDescription = t.translated_content;
      }
    }
  }

  return {
    id: data.id,
    slug: data.slug,
    name: storeName,
    description: storeDescription,
    logo_url: data.logo_url,
    primary_color: data.primary_color,
    currency: data.currency || 'EUR',
    country: data.country || 'NL',
    contact_email: data.contact_email,
    contact_phone: data.contact_phone,
  };
}

// ============== DOMAIN RESOLUTION ==============

async function resolveDomain(supabase: any, params: Record<string, unknown>) {
  const hostname = (params.hostname as string || '').toLowerCase().trim();
  if (!hostname) throw new Error('hostname is required');

  // Look up domain
  const { data: domain, error } = await supabase
    .from('tenant_domains')
    .select('id, tenant_id, domain, locale, is_canonical, is_active, dns_verified, ssl_active')
    .eq('domain', hostname)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!domain) throw new Error('Domain not found');

  // Get tenant info
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug, name, store_name')
    .eq('id', domain.tenant_id)
    .single();

  if (!tenant) throw new Error('Tenant not found for domain');

  // Get theme settings (custom frontend info)
  const { data: themeSettings } = await supabase
    .from('tenant_theme_settings')
    .select('use_custom_frontend, custom_frontend_url')
    .eq('tenant_id', domain.tenant_id)
    .maybeSingle();

  // Get all active domains for this tenant (for hreflang)
  const { data: allDomains } = await supabase
    .from('tenant_domains')
    .select('domain, locale, is_canonical')
    .eq('tenant_id', domain.tenant_id)
    .eq('is_active', true);

  return {
    tenant_id: tenant.id,
    tenant_slug: tenant.slug,
    tenant_name: tenant.store_name || tenant.name,
    locale: domain.locale,
    is_canonical: domain.is_canonical,
    dns_verified: domain.dns_verified,
    ssl_active: domain.ssl_active,
    use_custom_frontend: themeSettings?.use_custom_frontend || false,
    custom_frontend_url: themeSettings?.custom_frontend_url || null,
    all_domains: (allDomains || []).map((d: any) => ({
      domain: d.domain,
      locale: d.locale,
      is_canonical: d.is_canonical,
    })),
  };
}

async function getProducts(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const locale = params?.locale as string | undefined;

  let query = supabase
    .from('products')
    .select(`
      id, name, slug, description, price, compare_at_price, images, is_active, hide_from_storefront,
      track_inventory, stock, sku, category_id, categories(id, name, slug, hide_from_storefront)
    `)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('hide_from_storefront', false);

  if (params?.category_id) query = query.eq('category_id', params.category_id);
  if (params?.search) query = query.ilike('name', `%${params.search}%`);
  if (params?.limit) query = query.limit(Number(params.limit));

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  // Filter out products whose category is hidden from storefront
  const visibleProducts = data.filter((product: any) => {
    if (product.categories && product.categories.hide_from_storefront) return false;
    return true;
  });

  // Fetch translations if locale is provided
  let translationsMap: Record<string, Record<string, string>> = {};
  if (locale && visibleProducts.length > 0) {
    const productIds = visibleProducts.map((p: any) => p.id);
    const { data: translations } = await supabase
      .from('content_translations')
      .select('entity_id, field_name, translated_content')
      .eq('tenant_id', tenantId)
      .eq('entity_type', 'product')
      .in('entity_id', productIds)
      .eq('target_language', locale);

    if (translations) {
      for (const t of translations) {
        if (!translationsMap[t.entity_id]) translationsMap[t.entity_id] = {};
        if (t.translated_content) translationsMap[t.entity_id][t.field_name] = t.translated_content;
      }
    }
  }

  return visibleProducts.map((product: any) => {
    const t = translationsMap[product.id] || {};
    return {
      id: product.id,
      name: t.name || product.name,
      slug: product.slug,
      description: t.description || product.description,
      price: product.price,
      compare_at_price: product.compare_at_price,
      images: product.images || [],
      in_stock: !product.track_inventory || product.stock > 0,
      stock: product.track_inventory ? product.stock : null,
      sku: product.sku,
      category: product.categories ? { id: product.categories.id, name: product.categories.name, slug: product.categories.slug } : null,
    };
  });
}

async function getShippingMethods(supabase: any, tenantId: string) {
  const { data, error } = await supabase
    .from('shipping_methods')
    .select('id, name, description, price, free_above, estimated_days_min, estimated_days_max, is_default')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  return data.map((method: any) => ({
    id: method.id,
    name: method.name,
    description: method.description,
    price: method.price,
    free_above: method.free_above,
    estimated_days: method.estimated_days_min && method.estimated_days_max
      ? `${method.estimated_days_min}-${method.estimated_days_max}`
      : method.estimated_days_min || method.estimated_days_max || null,
    is_default: method.is_default,
  }));
}

async function getServicePoints(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const { postal_code, country, carrier, house_number } = params as {
    postal_code: string; country: string; carrier?: string; house_number?: string;
  };

  if (!postal_code || !country) throw new Error('postal_code and country are required');

  const { data: integration, error: integrationError } = await supabase
    .from('shipping_integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (integrationError) throw integrationError;
  if (!integration) return { provider: 'none', service_points: [] };

  const credentials = integration.credentials || {};
  let servicePoints: ServicePoint[] = [];

  switch (integration.provider) {
    case 'sendcloud': {
      const apiKey = credentials.api_key;
      const apiSecret = credentials.api_secret;
      if (!apiKey || !apiSecret) throw new Error('Sendcloud credentials not configured');

      const authHeader = btoa(`${apiKey}:${apiSecret}`);
      let url = `https://servicepoints.sendcloud.sc/api/v2/service-points?country=${country}&postal_code=${postal_code}`;
      if (carrier) url += `&carrier=${carrier}`;
      if (house_number) url += `&house_number=${house_number}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        console.error('Sendcloud error:', await response.text());
        throw new Error(`Sendcloud API error: ${response.status}`);
      }

      const data = await response.json();
      servicePoints = (data || []).map((point: any) => ({
        id: String(point.id),
        name: point.name,
        carrier: point.carrier,
        type: point.is_locker ? 'locker' : 'pickup_point',
        address: { street: point.street, house_number: point.house_number, city: point.city, postal_code: point.postal_code, country: point.country },
        distance: point.distance,
        latitude: point.latitude,
        longitude: point.longitude,
        opening_hours: point.formatted_opening_times || {},
      }));
      break;
    }
    case 'myparcel': {
      const apiKey = credentials.api_key;
      if (!apiKey) throw new Error('MyParcel API key not configured');

      const carrierMap: Record<string, string> = { 'postnl': 'postnl', 'dhl': 'dhlforyou', 'dpd': 'dpd' };
      const myparcelCarrier = carrier ? carrierMap[carrier.toLowerCase()] || carrier : 'postnl';

      const response = await fetch(
        `https://api.myparcel.nl/pickup_locations?cc=${country}&postal_code=${postal_code}&carrier=${myparcelCarrier}`,
        { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
      );

      if (!response.ok) {
        console.error('MyParcel error:', await response.text());
        throw new Error(`MyParcel API error: ${response.status}`);
      }

      const data = await response.json();
      const locations = data.data?.pickup_locations || [];

      servicePoints = locations.map((point: any) => ({
        id: point.location_code || String(point.location_id),
        name: point.location_name || point.retail_network_id,
        carrier: point.carrier?.human || carrier || 'postnl',
        type: point.is_locker ? 'locker' : 'pickup_point',
        address: { street: point.street, house_number: point.number, city: point.city, postal_code: point.postal_code, country: point.cc },
        distance: point.distance,
        latitude: point.latitude,
        longitude: point.longitude,
        opening_hours: formatMyParcelOpeningHours(point.opening_hours),
      }));
      break;
    }
    default:
      return { provider: 'manual', service_points: [] };
  }

  return { provider: integration.provider, service_points: servicePoints };
}

function formatMyParcelOpeningHours(hours: any[]): Record<string, string> {
  if (!hours || !Array.isArray(hours)) return {};
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const result: Record<string, string> = {};
  hours.forEach((day: any, index: number) => {
    if (day?.length > 0) {
      result[days[index]] = day.map((slot: any) => `${slot.start}-${slot.end}`).join(', ');
    }
  });
  return result;
}

// ============== PROMOTION CALCULATION ==============

async function calculatePromotions(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const { items, customer_id, discount_code, loyalty_points_to_redeem = 0 } = params as {
    items: CartItem[];
    customer_id?: string;
    discount_code?: string;
    loyalty_points_to_redeem?: number;
  };

  if (!items || items.length === 0) {
    return { original_subtotal: 0, discounted_subtotal: 0, total_discount: 0, applied_discounts: [], gifts: [], free_shipping: false };
  }

  const originalSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartProductIds = items.map(i => i.product_id);
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

  // Fetch all promotions in parallel
  const [
    { data: volumeDiscounts },
    { data: bogoPromotions },
    { data: bundles },
    { data: autoDiscounts },
    { data: giftPromotions },
    { data: stackingRules },
    discountCodeData,
    customerGroupData,
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
      if (discount > 0) {
        allDiscounts.push({ type: 'volume', name: vd.name, value: discount, source_id: vd.id, description: `Staffelkorting: ${tier.discount_value}${tier.discount_type === 'percentage' ? '%' : '€'}` });
      }
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

    if (discountTotal > 0) {
      allDiscounts.push({ type: 'bogo', name: promo.name, value: discountTotal, source_id: promo.id });
    }
  }

  // 3. BUNDLE DISCOUNTS
  for (const bundle of bundles || []) {
    if (!isPromotionActive(true, bundle.valid_from, bundle.valid_until)) continue;
    if (!bundle.bundle_products?.length) continue;

    if (bundle.bundle_type === 'fixed') {
      const required = bundle.bundle_products.filter((bp: any) => bp.is_required);
      let complete = true;
      let maxBundles = Infinity;
      let bundlePrice = 0;

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
      freeShipping = true;
      freeShippingReason = ad.name;
      allDiscounts.push({ type: 'automatic', name: ad.name, value: 0, source_id: ad.id, description: 'Gratis verzending' });
    } else if (ad.discount_type !== 'free_product') {
      const base = ad.applies_to === 'specific_products' && ad.product_ids ? 
        items.filter(i => ad.product_ids.includes(i.product_id)).reduce((s, i) => s + i.price * i.quantity, 0) : originalSubtotal;
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
      gifts.push({
        product_id: gp.gift_product_id,
        product_name: gp.gift_product?.name || 'Cadeau',
        quantity: giftQty,
        promotion_id: gp.id,
        promotion_name: gp.name,
        product_image: gp.gift_product?.image_url,
      });
    }
  }

  // 6. DISCOUNT CODE
  if (discountCodeData?.data) {
    const dc = discountCodeData.data;
    if (isPromotionActive(dc.is_active, dc.valid_from, dc.valid_until)) {
      if (!dc.usage_limit || dc.usage_count < dc.usage_limit) {
        if (!dc.minimum_order_amount || originalSubtotal >= dc.minimum_order_amount) {
          let base = originalSubtotal;
          if (dc.applies_to === 'specific_products' && dc.product_ids?.length) {
            base = items.filter(i => dc.product_ids.includes(i.product_id)).reduce((s, i) => s + i.price * i.quantity, 0);
          }
          const discount = calculateDiscountValue(base, dc.discount_type, dc.discount_value, dc.maximum_discount_amount);
          if (discount > 0) {
            allDiscounts.push({ type: 'discount_code', name: dc.code, value: discount, source_id: dc.id, description: `${dc.discount_value}${dc.discount_type === 'percentage' ? '%' : '€'} korting` });
          }
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
      if (discount > 0) {
        allDiscounts.push({ type: 'customer_group', name: primaryGroup.name, value: discount, source_id: primaryGroup.id });
      }
    }
  }

  // 8. APPLY STACKING RULES
  const activeRule = stackingRules?.[0];
  let finalDiscounts = allDiscounts;

  if (activeRule?.rule_type === 'no_stacking') {
    finalDiscounts = allDiscounts.sort((a, b) => b.value - a.value).slice(0, 1);
  } else if (activeRule) {
    if (activeRule.priority_order?.length) {
      finalDiscounts = allDiscounts.sort((a, b) => {
        const aIdx = activeRule.priority_order.indexOf(a.type);
        const bIdx = activeRule.priority_order.indexOf(b.type);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
    }
    if (activeRule.max_stack_count) finalDiscounts = finalDiscounts.slice(0, activeRule.max_stack_count);
    if (activeRule.max_total_discount_percent) {
      const maxDiscount = originalSubtotal * (activeRule.max_total_discount_percent / 100);
      let running = 0;
      finalDiscounts = finalDiscounts.filter(d => {
        if (running + d.value <= maxDiscount) { running += d.value; return true; }
        return false;
      });
    }
  }

  const totalDiscount = finalDiscounts.reduce((sum, d) => sum + d.value, 0);

  return {
    original_subtotal: originalSubtotal,
    discounted_subtotal: Math.max(0, originalSubtotal - totalDiscount),
    total_discount: totalDiscount,
    applied_discounts: finalDiscounts,
    gifts,
    free_shipping: freeShipping,
    free_shipping_reason: freeShippingReason,
    loyalty_points_earned: 0, // TODO: integrate loyalty
    loyalty_points_redeemed: 0,
  };
}

async function validateDiscountCode(supabase: any, tenantId: string, params: Record<string, unknown>) {
  const { code, subtotal = 0, customer_id } = params as { code: string; subtotal?: number; customer_id?: string };

  if (!code) return { valid: false, error: 'Geen kortingscode opgegeven' };

  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('code', code)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { valid: false, error: 'Ongeldige kortingscode' };

  if (!isPromotionActive(data.is_active, data.valid_from, data.valid_until)) {
    return { valid: false, error: 'Deze kortingscode is niet meer geldig' };
  }

  if (data.usage_limit && data.usage_count >= data.usage_limit) {
    return { valid: false, error: 'Deze kortingscode is niet meer beschikbaar' };
  }

  if (data.minimum_order_amount && subtotal < data.minimum_order_amount) {
    return { valid: false, error: `Minimaal bestelbedrag: €${data.minimum_order_amount.toFixed(2)}` };
  }

  // Check per-customer usage
  if (customer_id && data.usage_limit_per_customer) {
    const { count } = await supabase
      .from('discount_code_usage')
      .select('*', { count: 'exact', head: true })
      .eq('discount_code_id', data.id)
      .eq('customer_email', customer_id);
    
    if (count && count >= data.usage_limit_per_customer) {
      return { valid: false, error: 'Je hebt deze kortingscode al gebruikt' };
    }
  }

  return {
    valid: true,
    discount_type: data.discount_type,
    discount_value: data.discount_value,
    applies_to: data.applies_to,
    description: data.description,
  };
}

// ============== MAIN HANDLER ==============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: StorefrontRequest = await req.json();
    const { action, tenant_id, params = {} } = body;

    // resolve_domain doesn't require tenant_id
    if (action === 'resolve_domain') {
      const result = await resolveDomain(supabase, params);
      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: unknown;

    switch (action) {
      case 'get_tenant':
        result = await getTenant(supabase, tenant_id, params);
        break;
      case 'get_products':
        result = await getProducts(supabase, tenant_id, params);
        break;
      case 'get_shipping_methods':
        result = await getShippingMethods(supabase, tenant_id);
        break;
      case 'get_service_points':
        result = await getServicePoints(supabase, tenant_id, params);
        break;
      case 'calculate_promotions':
        result = await calculatePromotions(supabase, tenant_id, params);
        break;
      case 'validate_discount_code':
        result = await validateDiscountCode(supabase, tenant_id, params);
        break;
      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Storefront API error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
