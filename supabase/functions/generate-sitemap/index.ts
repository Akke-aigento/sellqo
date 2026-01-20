import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, baseUrl } = await req.json();

    if (!tenantId || !baseUrl) {
      return new Response(
        JSON.stringify({ error: 'tenantId and baseUrl are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, slug, name, updated_at, images')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (productsError) {
      console.error('Error fetching products:', productsError);
      throw productsError;
    }

    // Fetch active categories
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, slug, name, updated_at, image_url')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      throw categoriesError;
    }

    const urls: SitemapUrl[] = [];
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    // Add homepage
    urls.push({
      loc: normalizedBaseUrl,
      changefreq: 'daily',
      priority: 1.0,
    });

    // Add category pages
    for (const category of categories || []) {
      const slug = category.slug || category.id;
      urls.push({
        loc: `${normalizedBaseUrl}/category/${slug}`,
        lastmod: category.updated_at ? new Date(category.updated_at).toISOString().split('T')[0] : undefined,
        changefreq: 'weekly',
        priority: 0.8,
      });
    }

    // Add product pages
    for (const product of products || []) {
      const slug = product.slug || product.id;
      urls.push({
        loc: `${normalizedBaseUrl}/product/${slug}`,
        lastmod: product.updated_at ? new Date(product.updated_at).toISOString().split('T')[0] : undefined,
        changefreq: 'weekly',
        priority: 0.7,
      });
    }

    // Generate XML
    const xml = generateSitemapXml(urls);

    // Also generate image sitemap for products with images
    const imageUrls = (products || [])
      .filter(p => p.images && p.images.length > 0)
      .map(p => ({
        loc: `${normalizedBaseUrl}/product/${p.slug || p.id}`,
        images: (p.images as string[]).map(img => ({
          loc: img,
          title: p.name,
        })),
      }));

    const imageSitemap = generateImageSitemapXml(imageUrls, normalizedBaseUrl);

    // Generate sitemap index
    const sitemapIndex = generateSitemapIndex(normalizedBaseUrl);

    return new Response(
      JSON.stringify({
        sitemap: xml,
        imageSitemap,
        sitemapIndex,
        stats: {
          totalUrls: urls.length,
          products: products?.length || 0,
          categories: categories?.length || 0,
          productsWithImages: imageUrls.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sitemap generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateSitemapXml(urls: SitemapUrl[]): string {
  const urlElements = urls.map(url => {
    let element = `  <url>\n    <loc>${escapeXml(url.loc)}</loc>`;
    if (url.lastmod) element += `\n    <lastmod>${url.lastmod}</lastmod>`;
    if (url.changefreq) element += `\n    <changefreq>${url.changefreq}</changefreq>`;
    if (url.priority !== undefined) element += `\n    <priority>${url.priority.toFixed(1)}</priority>`;
    element += '\n  </url>';
    return element;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;
}

function generateImageSitemapXml(
  urls: Array<{ loc: string; images: Array<{ loc: string; title: string }> }>,
  baseUrl: string
): string {
  if (urls.length === 0) return '';

  const urlElements = urls.map(url => {
    const imageElements = url.images.map(img => `      <image:image>
        <image:loc>${escapeXml(img.loc)}</image:loc>
        <image:title>${escapeXml(img.title)}</image:title>
      </image:image>`).join('\n');

    return `  <url>
    <loc>${escapeXml(url.loc)}</loc>
${imageElements}
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlElements}
</urlset>`;
}

function generateSitemapIndex(baseUrl: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${escapeXml(baseUrl)}/sitemap.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${escapeXml(baseUrl)}/sitemap-images.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
