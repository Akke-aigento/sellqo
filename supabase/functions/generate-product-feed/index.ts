import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { loadStorefrontUrlContext } from "../_shared/storefrontUrls.ts";
import { feedHomeUrl, feedLinkProblem, feedLinkProblemDetail, withFeedLinks } from "./feedLinks.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'x-feed-skipped-no-link',
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
  currency: string | null;
  /** FEED-LINK-1: homepage van de winkel (template-origin of SellQo-winkel), nooit gegokt. */
  homeUrl: string;
}

type FeedProduct = Product & { link: string };

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
      .select('id, name, currency')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenantRow) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FEED-LINK-1: productlinks uit _shared/storefrontUrls.ts (zelfde regels als de mails):
    // template van een custom frontend, anders de SellQo-winkel op /producten/<slug>
    // (canoniek domein of <slug>.sellqo.shop als de winkel online staat). Vroeger:
    // sellqo.app/shop/<tenant>/product/<slug>, de oude ingebouwde shop.
    const linkCtx = await loadStorefrontUrlContext(supabase, tenantId);
    const problem = feedLinkProblem(linkCtx);
    const homeUrl = feedHomeUrl(linkCtx);
    if (problem || !homeUrl) {
      const reason = problem ?? 'shop_not_live';
      return new Response(
        JSON.stringify({ error: 'Product link not configured', reason, detail: feedLinkProblemDetail(reason) }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const tenant: Tenant = { id: tenantRow.id, name: tenantRow.name, currency: tenantRow.currency, homeUrl };

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
    const filteredProducts = ((products || []) as Product[]).filter((p) => {
      // If social_channels is empty or doesn't have this channel, include all products
      if (!p.social_channels || Object.keys(p.social_channels).length === 0) {
        return true;
      }
      return p.social_channels[format] === true || p.social_channels[channelKey] === true;
    });

    // FEED-LINK-1: Google, Meta en Pinterest eisen een link per product. Zonder werkende link
    // hoort een product niet in de feed: eruit, geteld in een header en in de log.
    const { items: feedProducts, skipped } = withFeedLinks(linkCtx, filteredProducts);
    if (skipped > 0) {
      console.log(`generate-product-feed: ${skipped} product(s) without a link left out (tenant ${tenantId}, ${format})`);
    }

    // Generate feed based on format
    let feedContent: string;
    let contentType: string;

    switch (format) {
      case 'google_shopping':
      case 'microsoft_shopping':
        feedContent = generateGoogleFeed(feedProducts, tenant);
        contentType = 'application/xml';
        break;
      case 'facebook':
      case 'facebook_shop':
        feedContent = generateFacebookCSV(feedProducts, tenant);
        contentType = 'text/csv';
        break;
      case 'pinterest_catalog':
        feedContent = generatePinterestRSS(feedProducts, tenant);
        contentType = 'application/rss+xml';
        break;
      default:
        feedContent = generateGoogleFeed(feedProducts, tenant);
        contentType = 'application/xml';
    }

    // Update last_feed_generated_at
    await supabase
      .from('social_channel_connections')
      .update({ 
        last_feed_generated_at: new Date().toISOString(),
        products_synced: feedProducts.length 
      })
      .eq('tenant_id', tenantId)
      .eq('channel_type', format);

    return new Response(feedContent, {
      headers: { ...corsHeaders, 'Content-Type': contentType, 'X-Feed-Skipped-No-Link': String(skipped) },
    });

  } catch (err) {
    console.error('Feed generation error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateGoogleFeed(products: FeedProduct[], tenant: Tenant): string {
  const baseUrl = tenant.homeUrl;
  const currency = tenant.currency || 'EUR';

  const items = products.map(product => {
    const categoryName = product.category?.[0]?.name || '';
    return `
    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${escapeXml(product.name)}</g:title>
      <g:description>${escapeXml(stripHtml(product.description || product.name))}</g:description>
      <g:link>${escapeXml(product.link)}</g:link>
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

function generateFacebookCSV(products: FeedProduct[], tenant: Tenant): string {
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
      csvEscape(product.link),
      csvEscape(product.featured_image || product.images?.[0] || ''),
      csvEscape(tenant.name),
      csvEscape(product.barcode || ''),
      csvEscape(product.sku || ''),
      csvEscape(product.category?.[0]?.name || '')
    ].join(',');
  });

  return [headers, ...rows].join('\n');
}

function generatePinterestRSS(products: FeedProduct[], tenant: Tenant): string {
  const baseUrl = tenant.homeUrl;
  const currency = tenant.currency || 'EUR';

  const items = products.map(product => `
    <item>
      <title>${escapeXml(product.name)}</title>
      <link>${escapeXml(product.link)}</link>
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
