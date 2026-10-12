import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
};

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  featured_image: string | null;
  images: string[];
  stock: number;
  track_inventory: boolean | null;
  hide_from_storefront: boolean | null;
  barcode: string | null;
  sku: string | null;
  slug: string;
  category: { name: string }[] | null;
  social_channels: Record<string, boolean> | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  currency: string | null;
  product_url_template: string | null;
  use_custom_frontend: boolean;
}

// SELLQO-FEED-1: de productlink hangt af van waar de winkel draait. Custom frontends hebben
// elk hun eigen pad (loveke.be/shop/<slug>, mancinimilano.com/streetwear/products/<slug>, …),
// dus daar is tenants.product_url_template verplicht; zonder template geen feed, want Google
// weigert of misleidt bij een verkeerde link. SellQo-theme: sellqo.app/shop/<tenant>/product/<slug>.
function productUrl(tenant: Tenant, slug: string): string | null {
  if (tenant.product_url_template) {
    return tenant.product_url_template.replace('{slug}', encodeURIComponent(slug));
  }
  if (tenant.use_custom_frontend) return null;
  return `https://sellqo.app/shop/${encodeURIComponent(tenant.slug)}/product/${encodeURIComponent(slug)}`;
}

function shopUrl(tenant: Tenant): string {
  if (tenant.product_url_template) {
    try {
      return new URL(tenant.product_url_template.replace('{slug}', 'x')).origin;
    } catch {
      /* val terug */
    }
  }
  return `https://sellqo.app/shop/${encodeURIComponent(tenant.slug)}`;
}

/** Bij een uitverkoop is price de verkoopprijs en compare_at_price de oorspronkelijke prijs. */
function prices(p: Product): { regular: number; sale: number | null } {
  const price = Number(p.price);
  const was = p.compare_at_price === null ? null : Number(p.compare_at_price);
  return was !== null && was > price ? { regular: was, sale: price } : { regular: price, sale: null };
}

const inStock = (p: Product) => p.track_inventory === false || p.stock > 0;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id');
    const format = url.searchParams.get('format') || 'google_shopping';

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get tenant info
    // SELLQO-FEED-1: deze select vroeg company_name/website_url/default_currency op, kolommen
    // die niet bestaan; daardoor gaf de feed voor elke winkel "Tenant not found".
    const { data: tenantRow, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, slug, currency, product_url_template')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenantRow) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: theme } = await supabase
      .from('tenant_theme_settings')
      .select('use_custom_frontend')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const tenant: Tenant = { ...tenantRow, use_custom_frontend: theme?.use_custom_frontend === true };

    if (!productUrl(tenant, 'x')) {
      return new Response(
        JSON.stringify({
          error: 'Product link not configured',
          detail: 'This shop runs on its own website. Set tenants.product_url_template (e.g. https://yourshop.com/shop/{slug}) so the feed can link to the right product pages.',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get products with social channels enabled for this format
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id, name, description, price, compare_at_price, 
        featured_image, images, stock, track_inventory, hide_from_storefront, barcode, sku, slug,
        category:categories(name),
        social_channels
      `)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .or('hide_from_storefront.is.null,hide_from_storefront.eq.false');

    if (productsError) {
      throw productsError;
    }

    // Filter products by channel
    const channelKey = format.replace('_catalog', '').replace('_shopping', '_shopping');
    const filteredProducts = (products || []).filter((p) => {
      // If social_channels is empty or doesn't have this channel, include all products
      if (!p.social_channels || Object.keys(p.social_channels).length === 0) {
        return true;
      }
      return p.social_channels[format] === true || p.social_channels[channelKey] === true;
    });

    // Generate feed based on format
    let feedContent: string;
    let contentType: string;

    switch (format) {
      case 'google_shopping':
      case 'microsoft_shopping':
        feedContent = generateGoogleFeed(filteredProducts, tenant);
        contentType = 'application/xml';
        break;
      case 'facebook':
      case 'facebook_shop':
        feedContent = generateFacebookCSV(filteredProducts, tenant);
        contentType = 'text/csv';
        break;
      case 'pinterest_catalog':
        feedContent = generatePinterestRSS(filteredProducts, tenant);
        contentType = 'application/rss+xml';
        break;
      default:
        feedContent = generateGoogleFeed(filteredProducts, tenant);
        contentType = 'application/xml';
    }

    // Update last_feed_generated_at
    await supabase
      .from('social_channel_connections')
      .update({ 
        last_feed_generated_at: new Date().toISOString(),
        products_synced: filteredProducts.length 
      })
      .eq('tenant_id', tenantId)
      .eq('channel_type', format);

    return new Response(feedContent, {
      headers: { ...corsHeaders, 'Content-Type': contentType },
    });

  } catch (err) {
    console.error('Feed generation error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateGoogleFeed(products: Product[], tenant: Tenant): string {
  const baseUrl = shopUrl(tenant);
  const currency = tenant.currency || 'EUR';

  const items = products.map(product => {
    const categoryName = product.category?.[0]?.name || '';
    return `
    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${escapeXml(product.name)}</g:title>
      <g:description>${escapeXml(stripHtml(product.description || product.name))}</g:description>
      <g:link>${escapeXml(productUrl(tenant, product.slug) ?? '')}</g:link>
      <g:image_link>${escapeXml(product.featured_image || product.images?.[0] || '')}</g:image_link>
      ${product.images?.slice(1, 10).map(img => `<g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`).join('\n      ') || ''}
      <g:price>${prices(product).regular.toFixed(2)} ${currency}</g:price>
      ${prices(product).sale !== null ? `<g:sale_price>${prices(product).sale!.toFixed(2)} ${currency}</g:sale_price>` : ''}
      <g:availability>${inStock(product) ? 'in_stock' : 'out_of_stock'}</g:availability>
      <g:condition>new</g:condition>
      <g:brand>${escapeXml(tenant.name)}</g:brand>
      ${product.barcode ? `<g:gtin>${escapeXml(product.barcode)}</g:gtin>` : ''}
      ${product.sku ? `<g:mpn>${escapeXml(product.sku)}</g:mpn>` : ''}
      ${categoryName ? `<g:product_type>${escapeXml(categoryName)}</g:product_type>` : ''}
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(tenant.name)} Product Feed</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Product catalog for ${escapeXml(tenant.name)}</description>
    ${items}
  </channel>
</rss>`;
}

function generateFacebookCSV(products: Product[], tenant: Tenant): string {
  const currency = tenant.currency || 'EUR';

  const headers = [
    'id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price',
    'link', 'image_link', 'brand', 'gtin', 'mpn', 'product_type'
  ].join(',');

  const rows = products.map(product => {
    return [
      csvEscape(product.id),
      csvEscape(product.name),
      csvEscape(stripHtml(product.description || product.name)),
      inStock(product) ? 'in stock' : 'out of stock',
      'new',
      `${prices(product).regular.toFixed(2)} ${currency}`,
      prices(product).sale !== null ? `${prices(product).sale!.toFixed(2)} ${currency}` : '',
      csvEscape(productUrl(tenant, product.slug) ?? ''),
      csvEscape(product.featured_image || product.images?.[0] || ''),
      csvEscape(tenant.name),
      csvEscape(product.barcode || ''),
      csvEscape(product.sku || ''),
      csvEscape(product.category?.[0]?.name || '')
    ].join(',');
  });

  return [headers, ...rows].join('\n');
}

function generatePinterestRSS(products: Product[], tenant: Tenant): string {
  const baseUrl = shopUrl(tenant);
  const currency = tenant.currency || 'EUR';

  const items = products.map(product => `
    <item>
      <title>${escapeXml(product.name)}</title>
      <link>${escapeXml(productUrl(tenant, product.slug) ?? '')}</link>
      <description>${escapeXml(stripHtml(product.description || product.name))}</description>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:price>${prices(product).regular.toFixed(2)} ${currency}</g:price>
      ${prices(product).sale !== null ? `<g:sale_price>${prices(product).sale!.toFixed(2)} ${currency}</g:sale_price>` : ''}
      <g:availability>${inStock(product) ? 'in stock' : 'out of stock'}</g:availability>
      <g:condition>new</g:condition>
      <g:image_link>${escapeXml(product.featured_image || product.images?.[0] || '')}</g:image_link>
      <g:brand>${escapeXml(tenant.name)}</g:brand>
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(tenant.name)} Pinterest Catalog</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Pinterest product catalog for ${escapeXml(tenant.name)}</description>
    ${items}
  </channel>
</rss>`;
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').substring(0, 5000);
}

function csvEscape(str: string): string {
  if (!str) return '""';
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
