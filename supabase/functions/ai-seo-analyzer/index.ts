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

function analyzeProduct(product: any): { score: number; issues: SEOIssue[] } {
  const issues: SEOIssue[] = [];
  let score = 100;

  if (!product.meta_title) {
    score -= 15;
    issues.push({ type: 'meta_title_missing', severity: 'warning', message: 'Meta title ontbreekt', field: 'meta_title', entity_id: product.id, entity_name: product.name });
  } else if (product.meta_title.length > 60) {
    score -= 5;
    issues.push({ type: 'meta_title_too_long', severity: 'info', message: `Meta title te lang (${product.meta_title.length} tekens)`, field: 'meta_title', entity_id: product.id, entity_name: product.name });
  } else if (product.meta_title.length < 30) {
    score -= 3;
    issues.push({ type: 'meta_title_too_short', severity: 'info', message: 'Meta title te kort', field: 'meta_title', entity_id: product.id, entity_name: product.name });
  }

  if (!product.meta_description) {
    score -= 15;
    issues.push({ type: 'meta_description_missing', severity: 'warning', message: 'Meta description ontbreekt', field: 'meta_description', entity_id: product.id, entity_name: product.name });
  } else if (product.meta_description.length > 160) {
    score -= 5;
    issues.push({ type: 'meta_description_too_long', severity: 'info', message: `Meta description te lang (${product.meta_description.length} tekens)`, field: 'meta_description', entity_id: product.id, entity_name: product.name });
  } else if (product.meta_description.length < 70) {
    score -= 3;
    issues.push({ type: 'meta_description_too_short', severity: 'info', message: 'Meta description te kort', field: 'meta_description', entity_id: product.id, entity_name: product.name });
  }

  if (!product.description) {
    score -= 20;
    issues.push({ type: 'description_missing', severity: 'error', message: 'Product beschrijving ontbreekt', field: 'description', entity_id: product.id, entity_name: product.name });
  } else if (product.description.length < 100) {
    score -= 10;
    issues.push({ type: 'thin_content', severity: 'warning', message: `Beschrijving te kort (${product.description.length} tekens)`, field: 'description', entity_id: product.id, entity_name: product.name });
  }

  if (!product.slug) {
    score -= 5;
    issues.push({ type: 'slug_missing', severity: 'info', message: 'URL slug ontbreekt', field: 'slug', entity_id: product.id, entity_name: product.name });
  }

  if (!product.images || product.images.length === 0) {
    score -= 10;
    issues.push({ type: 'images_missing', severity: 'warning', message: 'Geen afbeeldingen', field: 'images', entity_id: product.id, entity_name: product.name });
  }

  return { score: Math.max(0, score), issues };
}

function analyzeCategory(category: any): { score: number; issues: SEOIssue[] } {
  const issues: SEOIssue[] = [];
  let score = 100;

  if (!category.meta_title) {
    score -= 15;
    issues.push({ type: 'meta_title_missing', severity: 'warning', message: 'Meta title ontbreekt', field: 'meta_title', entity_id: category.id, entity_name: category.name });
  } else if (category.meta_title.length > 60) {
    score -= 5;
    issues.push({ type: 'meta_title_too_long', severity: 'info', message: `Meta title te lang (${category.meta_title.length} tekens)`, field: 'meta_title', entity_id: category.id, entity_name: category.name });
  }

  if (!category.meta_description) {
    score -= 15;
    issues.push({ type: 'meta_description_missing', severity: 'warning', message: 'Meta description ontbreekt', field: 'meta_description', entity_id: category.id, entity_name: category.name });
  } else if (category.meta_description.length > 160) {
    score -= 5;
    issues.push({ type: 'meta_description_too_long', severity: 'info', message: `Meta description te lang (${category.meta_description.length} tekens)`, field: 'meta_description', entity_id: category.id, entity_name: category.name });
  }

  if (!category.description) {
    score -= 20;
    issues.push({ type: 'description_missing', severity: 'warning', message: 'Categorie beschrijving ontbreekt', field: 'description', entity_id: category.id, entity_name: category.name });
  } else if (category.description.length < 50) {
    score -= 10;
    issues.push({ type: 'thin_content', severity: 'info', message: 'Beschrijving te kort', field: 'description', entity_id: category.id, entity_name: category.name });
  }

  if (!category.slug) {
    score -= 5;
    issues.push({ type: 'slug_missing', severity: 'info', message: 'URL slug ontbreekt', field: 'slug', entity_id: category.id, entity_name: category.name });
  }

  if (!category.image_url) {
    score -= 10;
    issues.push({ type: 'image_missing', severity: 'info', message: 'Geen afbeelding', field: 'image_url', entity_id: category.id, entity_name: category.name });
  }

  return { score: Math.max(0, score), issues };
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

    // Fetch products and categories in parallel
    const [productsResult, categoriesResult] = await Promise.all([
      supabase.from("products").select("id, name, description, meta_title, meta_description, slug, images, is_active").eq("tenant_id", tenantId).eq("is_active", true),
      supabase.from("categories").select("id, name, description, meta_title, meta_description, slug, image_url, is_active").eq("tenant_id", tenantId).eq("is_active", true),
    ]);

    if (productsResult.error) throw productsResult.error;
    if (categoriesResult.error) throw categoriesResult.error;

    const products = productsResult.data || [];
    const categories = categoriesResult.data || [];

    const issues: SEOIssue[] = [];
    const suggestions: SEOSuggestion[] = [];
    const productScores: Array<{ product_id: string; product_name: string; score: number; issues: SEOIssue[] }> = [];
    const categoryScores: Array<{ category_id: string; category_name: string; score: number; issues: SEOIssue[] }> = [];

    let totalMetaScore = 0;
    let totalContentScore = 0;

    // Analyze products
    for (const product of products) {
      const result = analyzeProduct(product);
      productScores.push({ product_id: product.id, product_name: product.name, score: result.score, issues: result.issues });
      issues.push(...result.issues);
      const hasGoodMeta = product.meta_title && product.meta_description;
      totalMetaScore += hasGoodMeta ? 100 : (product.meta_title || product.meta_description ? 50 : 0);
      totalContentScore += product.description ? (product.description.length > 200 ? 100 : 50) : 0;
    }

    // Analyze categories
    for (const category of categories) {
      const result = analyzeCategory(category);
      categoryScores.push({ category_id: category.id, category_name: category.name, score: result.score, issues: result.issues });
      issues.push(...result.issues);
      const hasGoodMeta = category.meta_title && category.meta_description;
      totalMetaScore += hasGoodMeta ? 100 : (category.meta_title || category.meta_description ? 50 : 0);
      totalContentScore += category.description ? (category.description.length > 100 ? 100 : 50) : 0;
    }

    const totalAnalyzed = products.length + categories.length;

    // Calculate overall scores
    const metaScore = totalAnalyzed > 0 ? Math.round(totalMetaScore / totalAnalyzed) : 0;
    const contentScore = totalAnalyzed > 0 ? Math.round(totalContentScore / totalAnalyzed) : 0;
    const technicalScore = 60;
    const aiSearchScore = Math.round((contentScore * 0.4 + metaScore * 0.3 + technicalScore * 0.3));
    const overallScore = Math.round(metaScore * 0.25 + contentScore * 0.35 + technicalScore * 0.2 + aiSearchScore * 0.2);

    // Generate suggestions
    const missingMetaTitles = issues.filter(i => i.type === 'meta_title_missing').length;
    const missingMetaDescs = issues.filter(i => i.type === 'meta_description_missing').length;
    const thinContent = issues.filter(i => i.type === 'thin_content' || i.type === 'description_missing').length;
    const missingCategoryMeta = categoryScores.filter(c => c.score < 70).length;

    if (missingMetaTitles > 0) {
      suggestions.push({ type: 'bulk_generate_meta_titles', priority: 'high', title: `Genereer ${missingMetaTitles} meta titles`, description: `Er zijn ${missingMetaTitles} items zonder meta title. Genereer deze met AI voor betere zoekresultaten.`, action: 'generate_meta_titles', estimated_impact: 15 });
    }
    if (missingMetaDescs > 0) {
      suggestions.push({ type: 'bulk_generate_meta_descriptions', priority: 'high', title: `Genereer ${missingMetaDescs} meta descriptions`, description: `Er zijn ${missingMetaDescs} items zonder meta description. Dit beïnvloedt je click-through rate.`, action: 'generate_meta_descriptions', estimated_impact: 12 });
    }
    if (thinContent > 0) {
      suggestions.push({ type: 'improve_content', priority: 'medium', title: `Verbeter ${thinContent} beschrijvingen`, description: `${thinContent} items hebben te weinig content. Langere, kwalitatieve beschrijvingen scoren beter.`, action: 'improve_content', estimated_impact: 20 });
    }
    if (missingCategoryMeta > 0) {
      suggestions.push({ type: 'optimize_categories', priority: 'medium', title: `Optimaliseer ${missingCategoryMeta} categorieën`, description: `${missingCategoryMeta} categorieën scoren onder 70. Verbeter hun SEO voor betere navigatie.`, action: 'optimize_categories', estimated_impact: 10 });
    }
    suggestions.push({ type: 'add_faq', priority: 'medium', title: 'Voeg FAQ sectie toe', description: 'FAQ content wordt vaak geciteerd door AI-zoekmachines. Voeg veelgestelde vragen toe aan je producten.', action: 'generate_faq', estimated_impact: 10 });

    // BATCH upserts — tenant score
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
        issues: issues.slice(0, 50),
        suggestions,
        last_analyzed_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,entity_type,entity_id' });

    if (upsertError) console.error("Error upserting tenant score:", upsertError);

    // BATCH upsert all product scores in ONE call
    if (productScores.length > 0) {
      const productUpsertData = productScores.map(ps => ({
        tenant_id: tenantId,
        entity_type: 'product',
        entity_id: ps.product_id,
        overall_score: ps.score,
        issues: ps.issues,
        last_analyzed_at: new Date().toISOString(),
      }));
      const { error: prodError } = await supabase
        .from("seo_scores")
        .upsert(productUpsertData, { onConflict: 'tenant_id,entity_type,entity_id' });
      if (prodError) console.error("Error batch upserting product scores:", prodError);
    }

    // BATCH upsert all category scores in ONE call
    if (categoryScores.length > 0) {
      const categoryUpsertData = categoryScores.map(cs => ({
        tenant_id: tenantId,
        entity_type: 'category',
        entity_id: cs.category_id,
        overall_score: cs.score,
        issues: cs.issues,
        last_analyzed_at: new Date().toISOString(),
      }));
      const { error: catError } = await supabase
        .from("seo_scores")
        .upsert(categoryUpsertData, { onConflict: 'tenant_id,entity_type,entity_id' });
      if (catError) console.error("Error batch upserting category scores:", catError);
    }

    // History + usage log in parallel
    await Promise.all([
      supabase.from("seo_analysis_history").insert({ tenant_id: tenantId, overall_score: overallScore }),
      supabase.from("ai_usage_log").insert({
        tenant_id: tenantId,
        feature: 'seo_analysis',
        credits_used: 2,
        metadata: { products_analyzed: products.length, categories_analyzed: categories.length, issues_found: issues.length },
      }),
    ]);

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
        category_scores: categoryScores,
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
