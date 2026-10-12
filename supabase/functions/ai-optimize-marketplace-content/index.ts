import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireBillingState } from "../_shared/billingGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptimizeRequest {
  product: {
    id: string;
    name: string;
    description?: string;
    short_description?: string;
    price: number;
    sku?: string;
    barcode?: string;
    category_name?: string;
    tags?: string[];
    images?: string[];
  };
  marketplace: 'bol_com' | 'amazon' | 'shopify' | 'woocommerce' | 'ebay';
  language?: string;
  /** AI-CRED-3: de winkel waarvoor dit gebeurt (oudere app-builds sturen hem niet mee). */
  tenantId?: string;
}

interface OptimizedContent {
  title: string;
  bullets: string[];
  description: string;
  category_suggestion?: string;
  keywords: string[];
  meta_title?: string;
  meta_description?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  // AI-CRED-3: neveneffectvrije versiestempel om een deploy te bewijzen.
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, version: "AI-CRED-3" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const auth = await authenticateRequest(req);
    const { product, marketplace, language = 'nl', tenantId: bodyTenantId }: OptimizeRequest = await req.json();

    // AI-CRED-3: deze functie kende geen winkel en was dus gratis voor elke ingelogde
    // gebruiker. Nu: winkel uit de body, of — voor oudere app-builds zonder tenantId —
    // de enige winkel van de gebruiker. Dan rol, leesmodus en credits zoals elders.
    const tenantId = bodyTenantId ?? (auth.tenant_ids.length === 1 ? auth.tenant_ids[0] : null);
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'tenantId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!auth.is_platform_admin && auth.user_id !== 'service_role' && !auth.tenant_ids.includes(tenantId)) {
      throw new AuthError('No access to this tenant', 403);
    }
    requireRole(auth, tenantId, ['tenant_admin', 'staff', 'marketing']);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await requireBillingState(supabase, auth, tenantId, 'ai_assistant');
    
    if (!product?.name) {
      return new Response(
        JSON.stringify({ error: 'Product name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: hasCredits, error: creditErr } = await supabase.rpc('use_ai_credits', {
      p_tenant_id: tenantId,
      p_credits: 1,
      p_feature: 'marketplace_optimize',
      p_model: 'google/gemini-2.5-flash',
      p_metadata: { marketplace, productId: product.id },
    });
    if (creditErr || !hasCredits) {
      return new Response(
        JSON.stringify({ error: 'Onvoldoende AI credits' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build prompt based on marketplace
    let marketplaceRules: string;
    let marketplaceName: string;
    
    if (marketplace === 'bol_com') {
      marketplaceName = 'Bol.com (Dutch marketplace)';
      marketplaceRules = `
        - Title: Max 150 characters, include brand + product type + key feature
        - 5 bullet points max 150 chars each, start with benefit/feature
        - Description for Dutch consumers, clear and professional
        - SEO keywords for Dutch market
      `;
    } else if (marketplace === 'amazon') {
      marketplaceName = 'Amazon';
      marketplaceRules = `
        - Title: Max 200 characters, brand + product + features + size
        - 5 bullet points max 500 chars each, start with CAPS keyword
        - A+ Content style description
        - SEO keywords for the specific Amazon marketplace
      `;
    } else if (marketplace === 'shopify') {
      marketplaceName = 'Shopify';
      marketplaceRules = `
        - Title: Max 255 characters, SEO-optimized with primary keyword at start
        - 5 bullet points for key product features and benefits (for product tabs/accordions)
        - Description: Rich HTML-formatted, SEO-friendly with proper headings
        - Tags: Comma-separated product tags for Shopify collections
        - meta_title: SEO title for browser tab/search (max 70 chars, include brand + keyword)
        - meta_description: Meta description for Google snippets (max 160 chars, compelling CTA)
        - Focus on conversion-oriented copywriting and SEO
      `;
    } else if (marketplace === 'woocommerce') {
      marketplaceName = 'WooCommerce';
      marketplaceRules = `
        - Title: SEO-optimized, 70 characters max for best display in search results
        - 5 bullet points for key product features (WooCommerce product tabs)
        - Short description: 150-300 characters, key selling points
        - Full description: HTML-formatted with h2/h3 headings, structured content
        - meta_title: Yoast/RankMath SEO title (max 60 chars, primary keyword first)
        - meta_description: Yoast/RankMath meta description (max 160 chars, actionable)
        - Focus on WooCommerce SEO best practices and WordPress search
      `;
    } else {
      // eBay
      marketplaceName = 'eBay';
      marketplaceRules = `
        - Title: Max 80 characters, brand + key features + product type, highly searchable
        - 5 bullet points for key features and specs
        - Description: HTML-formatted, structured with clear sections
        - Focus on eBay SEO: include popular search terms buyers use
        - Condition-specific language when applicable
        - Include compatible models/sizes if relevant
      `;
    }

    const prompt = `You are an e-commerce optimization expert. Optimize this product for ${marketplaceName}.

Product Information:
- Name: ${product.name}
- Description: ${product.description || 'Not provided'}
- Short Description: ${product.short_description || 'Not provided'}
- Price: €${product.price}
- Category: ${product.category_name || 'Unknown'}
- Tags: ${product.tags?.join(', ') || 'None'}
- SKU: ${product.sku || 'N/A'}
- EAN/Barcode: ${product.barcode || 'N/A'}

Marketplace Rules:
${marketplaceRules}

Language: ${language === 'nl' ? 'Dutch' : language === 'de' ? 'German' : language === 'fr' ? 'French' : 'English'}

Return a JSON object with this exact structure:
{
  "title": "optimized marketplace title",
  "bullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"],
  "description": "optimized product description paragraph",
  "category_suggestion": "suggested marketplace category path",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "meta_title": "SEO meta title for browser/search (only for shopify/woocommerce)",
  "meta_description": "SEO meta description for Google snippets (only for shopify/woocommerce)"
}

Only return valid JSON, no markdown or explanation.`;

    const response = await fetch('https://api.lovable.ai/v0/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AI API error:', error);
      return new Response(
        JSON.stringify({ error: 'AI optimization failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    // Parse AI response
    let optimizedContent: OptimizedContent;
    try {
      // Clean up potential markdown code blocks
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      optimizedContent = JSON.parse(cleanContent);
    } catch (parseError) {
    if (parseError instanceof AuthError) {
      return authErrorResponse(parseError, corsHeaders);
    }
      console.error('Failed to parse AI response:', content);
      // Fallback: create basic optimization
      optimizedContent = {
        title: product.name.substring(0, 150),
        bullets: [
          product.short_description || product.description?.substring(0, 150) || 'Hoogwaardige kwaliteit',
          `Prijs: €${product.price}`,
          product.category_name ? `Categorie: ${product.category_name}` : 'Direct beschikbaar',
          'Snelle levering',
          'Uitstekende klantenservice',
        ].filter(Boolean),
        description: product.description || product.short_description || product.name,
        keywords: product.tags || [product.name.toLowerCase()],
      };
    }

    // Validate and clean response based on marketplace
    const titleMaxLength = marketplace === 'bol_com' ? 150 : marketplace === 'amazon' ? 200 : marketplace === 'woocommerce' ? 70 : marketplace === 'ebay' ? 80 : 255;
    const bulletMaxLength = marketplace === 'bol_com' ? 150 : 500;
    
    // Meta fields max lengths based on SEO best practices
    const metaTitleMaxLength = marketplace === 'woocommerce' ? 60 : 70;
    const metaDescMaxLength = 160;

    const validatedContent: OptimizedContent = {
      title: (optimizedContent.title || product.name).substring(0, titleMaxLength),
      bullets: (optimizedContent.bullets || []).slice(0, 5).map(b => 
        typeof b === 'string' ? b.substring(0, bulletMaxLength) : String(b)
      ),
      description: optimizedContent.description || product.description || '',
      category_suggestion: optimizedContent.category_suggestion,
      keywords: (optimizedContent.keywords || []).slice(0, 10),
      meta_title: optimizedContent.meta_title?.substring(0, metaTitleMaxLength),
      meta_description: optimizedContent.meta_description?.substring(0, metaDescMaxLength),
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        optimized: validatedContent,
        marketplace,
        product_id: product.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error('Error optimizing content:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to optimize content';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
