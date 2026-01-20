import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SEOIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
  entity_id?: string;
  entity_name?: string;
}

interface SEOSuggestion {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: string;
  entity_id?: string;
  estimated_impact?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId } = await req.json();
    
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "tenantId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check and use AI credits (2 credits for SEO analysis)
    const { data: creditsUsed, error: creditsError } = await supabase.rpc(
      "use_ai_credits",
      { p_tenant_id: tenantId, p_credits_needed: 2 }
    );

    if (creditsError || !creditsUsed) {
      return new Response(
        JSON.stringify({ error: "Insufficient AI credits" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all products for the tenant
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, description, meta_title, meta_description, slug, images, is_active")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (productsError) throw productsError;

    const issues: SEOIssue[] = [];
    const suggestions: SEOSuggestion[] = [];
    const productScores: Array<{ product_id: string; product_name: string; score: number; issues: SEOIssue[] }> = [];

    let totalMetaScore = 0;
    let totalContentScore = 0;
    let productsAnalyzed = 0;

    // Analyze each product
    for (const product of products || []) {
      const productIssues: SEOIssue[] = [];
      let productScore = 100;

      // Check meta title
      if (!product.meta_title) {
        productScore -= 15;
        productIssues.push({
          type: 'meta_title_missing',
          severity: 'warning',
          message: `Meta title ontbreekt`,
          field: 'meta_title',
          entity_id: product.id,
          entity_name: product.name,
        });
      } else if (product.meta_title.length > 60) {
        productScore -= 5;
        productIssues.push({
          type: 'meta_title_too_long',
          severity: 'info',
          message: `Meta title te lang (${product.meta_title.length} tekens)`,
          field: 'meta_title',
          entity_id: product.id,
          entity_name: product.name,
        });
      } else if (product.meta_title.length < 30) {
        productScore -= 3;
        productIssues.push({
          type: 'meta_title_too_short',
          severity: 'info',
          message: `Meta title te kort`,
          field: 'meta_title',
          entity_id: product.id,
          entity_name: product.name,
        });
      }

      // Check meta description
      if (!product.meta_description) {
        productScore -= 15;
        productIssues.push({
          type: 'meta_description_missing',
          severity: 'warning',
          message: `Meta description ontbreekt`,
          field: 'meta_description',
          entity_id: product.id,
          entity_name: product.name,
        });
      } else if (product.meta_description.length > 160) {
        productScore -= 5;
        productIssues.push({
          type: 'meta_description_too_long',
          severity: 'info',
          message: `Meta description te lang (${product.meta_description.length} tekens)`,
          field: 'meta_description',
          entity_id: product.id,
          entity_name: product.name,
        });
      } else if (product.meta_description.length < 70) {
        productScore -= 3;
        productIssues.push({
          type: 'meta_description_too_short',
          severity: 'info',
          message: `Meta description te kort`,
          field: 'meta_description',
          entity_id: product.id,
          entity_name: product.name,
        });
      }

      // Check product description (content)
      if (!product.description) {
        productScore -= 20;
        productIssues.push({
          type: 'description_missing',
          severity: 'error',
          message: `Product beschrijving ontbreekt`,
          field: 'description',
          entity_id: product.id,
          entity_name: product.name,
        });
      } else if (product.description.length < 100) {
        productScore -= 10;
        productIssues.push({
          type: 'thin_content',
          severity: 'warning',
          message: `Beschrijving te kort (${product.description.length} tekens)`,
          field: 'description',
          entity_id: product.id,
          entity_name: product.name,
        });
      }

      // Check slug
      if (!product.slug) {
        productScore -= 5;
        productIssues.push({
          type: 'slug_missing',
          severity: 'info',
          message: `URL slug ontbreekt`,
          field: 'slug',
          entity_id: product.id,
          entity_name: product.name,
        });
      }

      // Check images
      if (!product.images || product.images.length === 0) {
        productScore -= 10;
        productIssues.push({
          type: 'images_missing',
          severity: 'warning',
          message: `Geen afbeeldingen`,
          field: 'images',
          entity_id: product.id,
          entity_name: product.name,
        });
      }

      productScores.push({
        product_id: product.id,
        product_name: product.name,
        score: Math.max(0, productScore),
        issues: productIssues,
      });

      issues.push(...productIssues);
      productsAnalyzed++;
      
      // Calculate sub-scores
      const hasGoodMeta = product.meta_title && product.meta_description;
      totalMetaScore += hasGoodMeta ? 100 : (product.meta_title || product.meta_description ? 50 : 0);
      totalContentScore += product.description ? (product.description.length > 200 ? 100 : 50) : 0;
    }

    // Calculate overall scores
    const metaScore = productsAnalyzed > 0 ? Math.round(totalMetaScore / productsAnalyzed) : 0;
    const contentScore = productsAnalyzed > 0 ? Math.round(totalContentScore / productsAnalyzed) : 0;
    const technicalScore = 60; // Base technical score (sitemap, robots, etc. not yet implemented)
    const aiSearchScore = Math.round((contentScore * 0.4 + metaScore * 0.3 + technicalScore * 0.3));
    
    const overallScore = Math.round(
      metaScore * 0.25 + 
      contentScore * 0.35 + 
      technicalScore * 0.2 + 
      aiSearchScore * 0.2
    );

    // Generate suggestions based on issues
    const missingMetaTitles = issues.filter(i => i.type === 'meta_title_missing').length;
    const missingMetaDescs = issues.filter(i => i.type === 'meta_description_missing').length;
    const thinContent = issues.filter(i => i.type === 'thin_content' || i.type === 'description_missing').length;

    if (missingMetaTitles > 0) {
      suggestions.push({
        type: 'bulk_generate_meta_titles',
        priority: 'high',
        title: `Genereer ${missingMetaTitles} meta titles`,
        description: `Er zijn ${missingMetaTitles} producten zonder meta title. Genereer deze met AI voor betere zoekresultaten.`,
        action: 'generate_meta',
        estimated_impact: 15,
      });
    }

    if (missingMetaDescs > 0) {
      suggestions.push({
        type: 'bulk_generate_meta_descriptions',
        priority: 'high',
        title: `Genereer ${missingMetaDescs} meta descriptions`,
        description: `Er zijn ${missingMetaDescs} producten zonder meta description. Dit beïnvloedt je click-through rate.`,
        action: 'generate_meta',
        estimated_impact: 12,
      });
    }

    if (thinContent > 0) {
      suggestions.push({
        type: 'improve_content',
        priority: 'medium',
        title: `Verbeter ${thinContent} productbeschrijvingen`,
        description: `${thinContent} producten hebben te weinig content. Langere, kwalitatieve beschrijvingen scoren beter.`,
        action: 'improve_content',
        estimated_impact: 20,
      });
    }

    // Add AI search suggestions
    suggestions.push({
      type: 'add_faq',
      priority: 'medium',
      title: 'Voeg FAQ sectie toe',
      description: 'FAQ content wordt vaak geciteerd door AI-zoekmachines. Voeg veelgestelde vragen toe aan je producten.',
      action: 'generate_faq',
      estimated_impact: 10,
    });

    // Upsert tenant SEO score
    const { error: upsertError } = await supabase
      .from("seo_scores")
      .upsert({
        tenant_id: tenantId,
        entity_type: 'tenant',
        entity_id: null,
        overall_score: overallScore,
        meta_score: metaScore,
        content_score: contentScore,
        technical_score: technicalScore,
        ai_search_score: aiSearchScore,
        issues: issues.slice(0, 50), // Limit stored issues
        suggestions,
        last_analyzed_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,entity_type,entity_id',
      });

    if (upsertError) {
      console.error("Error upserting tenant score:", upsertError);
    }

    // Upsert product scores
    for (const ps of productScores) {
      await supabase
        .from("seo_scores")
        .upsert({
          tenant_id: tenantId,
          entity_type: 'product',
          entity_id: ps.product_id,
          overall_score: ps.score,
          issues: ps.issues,
          last_analyzed_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,entity_type,entity_id',
        });
    }

    // Add to history
    await supabase
      .from("seo_analysis_history")
      .insert({
        tenant_id: tenantId,
        overall_score: overallScore,
      });

    // Log AI usage
    await supabase
      .from("ai_usage_log")
      .insert({
        tenant_id: tenantId,
        feature: 'seo_analysis',
        credits_used: 2,
        metadata: {
          products_analyzed: productsAnalyzed,
          issues_found: issues.length,
        },
      });

    return new Response(
      JSON.stringify({
        overall_score: overallScore,
        meta_score: metaScore,
        content_score: contentScore,
        technical_score: technicalScore,
        ai_search_score: aiSearchScore,
        issues,
        suggestions,
        product_scores: productScores,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("SEO Analyzer error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
