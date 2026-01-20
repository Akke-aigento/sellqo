import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TenantInfo {
  name: string;
  description: string | null;
}

async function generateContent(
  type: string,
  entity: { id: string; name: string; description?: string | null; price?: number },
  tenant: TenantInfo | null,
  lovableApiKey: string,
  entityType: 'product' | 'category'
): Promise<string | null> {
  let systemPrompt = "";
  let userPrompt = "";

  const entityLabel = entityType === 'category' ? 'categorie' : 'product';

  switch (type) {
    case "meta_title":
      systemPrompt = `Je bent een SEO-expert die meta titles schrijft. 
Regels:
- Max 60 tekens
- Bevat het belangrijkste keyword (${entityLabel}naam)
- Aantrekkelijk voor klikken
- Uniek per ${entityLabel}
- Nederlands taalgebruik`;
      userPrompt = `Schrijf een meta title voor deze ${entityLabel}:
Naam: ${entity.name}
Beschrijving: ${entity.description?.substring(0, 200) || 'Geen beschrijving'}
Winkel: ${tenant?.name || 'Webshop'}

Geef alleen de meta title terug, geen uitleg.`;
      break;

    case "meta_description":
      systemPrompt = `Je bent een SEO-expert die meta descriptions schrijft.
Regels:
- Max 155 tekens
- Bevat een call-to-action
- Vermeldt unique selling points
- Aantrekkelijk voor klikken
- Nederlands taalgebruik`;
      userPrompt = `Schrijf een meta description voor deze ${entityLabel}:
Naam: ${entity.name}
Beschrijving: ${entity.description?.substring(0, 300) || 'Geen beschrijving'}
${entity.price ? `Prijs: €${entity.price}` : ''}
Winkel: ${tenant?.name || 'Webshop'}

Geef alleen de meta description terug, geen uitleg.`;
      break;

    case "product_description":
    case "category_description":
      systemPrompt = `Je bent een copywriter die ${entityLabel}beschrijvingen optimaliseert voor SEO.
Regels:
- Minimaal 150 woorden
- Gebruik relevante keywords natuurlijk
- Structureer met bullet points waar nodig
- Vermeld voordelen en features
- Nederlands taalgebruik
- Schrijf voor de doelgroep, niet alleen voor zoekmachines`;
      userPrompt = `Herschrijf en optimaliseer deze ${entityLabel}beschrijving voor SEO:
Naam: ${entity.name}
Huidige beschrijving: ${entity.description || 'Geen beschrijving - schrijf een nieuwe'}
Winkel: ${tenant?.name || 'Webshop'}

Geef alleen de nieuwe beschrijving terug.`;
      break;

    case "alt_text":
      systemPrompt = `Je bent een SEO-expert die alt-teksten schrijft voor ${entityLabel}afbeeldingen.
Regels:
- Max 125 tekens
- Beschrijf wat er op de afbeelding te zien is
- Bevat de ${entityLabel}naam
- Geen "afbeelding van" of "foto van"
- Nederlands taalgebruik`;
      userPrompt = `Schrijf een alt-tekst voor de hoofdafbeelding van deze ${entityLabel}:
Naam: ${entity.name}
Beschrijving: ${entity.description?.substring(0, 200) || 'Geen beschrijving'}

Geef alleen de alt-tekst terug, geen uitleg.`;
      break;

    default:
      return null;
  }

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!aiResponse.ok) {
    console.error(`AI error for ${entityType} ${entity.id}:`, await aiResponse.text());
    return null;
  }

  const aiData = await aiResponse.json();
  return aiData.choices?.[0]?.message?.content?.trim() || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, type, productIds, categoryIds, entityType = 'product' } = await req.json();
    
    const ids = entityType === 'category' ? categoryIds : productIds;
    
    if (!tenantId || !type || !ids || ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "tenantId, type, and entity IDs are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate credits needed (1 per entity)
    const creditsNeeded = ids.length;

    // Check and use AI credits
    const { data: creditsUsed, error: creditsError } = await supabase.rpc(
      "use_ai_credits",
      { p_tenant_id: tenantId, p_credits_needed: creditsNeeded }
    );

    if (creditsError || !creditsUsed) {
      return new Response(
        JSON.stringify({ error: "Insufficient AI credits" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch tenant info for context
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, description")
      .eq("id", tenantId)
      .single();

    const results: Array<{ entity_id: string; generated: string; field: string }> = [];

    if (entityType === 'category') {
      const { data: categories, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name, description")
        .in("id", ids);

      if (categoriesError) throw categoriesError;

      for (const category of categories || []) {
        const generated = await generateContent(type, category, tenant, lovableApiKey, 'category');
        if (generated) {
          const updateField = type === 'category_description' ? 'description' : type;
          
          const { error: updateError } = await supabase
            .from("categories")
            .update({ [updateField]: generated })
            .eq("id", category.id);

          if (!updateError) {
            results.push({
              entity_id: category.id,
              generated,
              field: updateField,
            });
          }
        }
      }
    } else {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, description, price, category_id")
        .in("id", ids);

      if (productsError) throw productsError;

      for (const product of products || []) {
        const generated = await generateContent(type, product, tenant, lovableApiKey, 'product');
        if (generated) {
          const updateField = type === "product_description" ? "description" : type;
          
          const { error: updateError } = await supabase
            .from("products")
            .update({ [updateField]: generated })
            .eq("id", product.id);

          if (!updateError) {
            results.push({
              entity_id: product.id,
              generated,
              field: updateField,
            });
          }
        }
      }
    }

    // Log AI usage
    await supabase
      .from("ai_usage_log")
      .insert({
        tenant_id: tenantId,
        feature: `seo_generate_${type}`,
        credits_used: creditsNeeded,
        metadata: {
          entity_type: entityType,
          entities_processed: results.length,
          type,
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        generated: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("SEO Content Generator error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
