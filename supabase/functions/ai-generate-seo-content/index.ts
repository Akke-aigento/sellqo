import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TenantInfo {
  name: string;
}

type EntityType = 'product' | 'category';

// SEO-CAT-1: generator-type → bestaande kolom per entiteit. categories heeft geen
// meta_title/meta_description (wel meta_*_{nl,en,fr,de}); de prompts zijn Nederlands,
// dus categorie-meta gaat naar de _nl-kolommen. products heeft geen alt_text-kolom:
// alt-tekst gaat naar image_alt_texts[0]. Combinaties die hier niet staan → 400 vóór credits.
const FIELD_MAP: Record<EntityType, Record<string, string>> = {
  category: {
    meta_title: "meta_title_nl",
    meta_description: "meta_description_nl",
    category_description: "description",
  },
  product: {
    meta_title: "meta_title",
    meta_description: "meta_description",
    product_description: "description",
    alt_text: "image_alt_texts",
  },
};

function badRequest(error: string): Response {
  return new Response(
    JSON.stringify({ error }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
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
  // SCHEMA-FIX-1: neveneffectvrije versiestempel om de deploy te bewijzen.
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true, version: "SEO-CAT-1" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { tenantId, type, productIds, categoryIds, entityType = 'product' } = await req.json();
    

    await authenticateRequest(req, tenantId);
    const ids = entityType === 'category' ? categoryIds : productIds;
    
    if (!tenantId || !type || !ids || ids.length === 0) {
      return badRequest("tenantId, type, and entity IDs are required");
    }

    // SEO-CAT-1: onbekende entiteit of type/entiteit-combinatie zonder kolom → 400
    // vóór use_ai_credits, zodat de winkel niet betaalt voor een update die nooit kan landen.
    if (entityType !== "product" && entityType !== "category") {
      return badRequest(`Onbekend entityType '${String(entityType)}' (verwacht: product of category)`);
    }
    const fieldMap = FIELD_MAP[entityType as EntityType];
    const updateField = typeof type === "string" && Object.hasOwn(fieldMap, type) ? fieldMap[type] : null;
    if (!updateField) {
      return badRequest(
        `Type '${String(type)}' wordt niet ondersteund voor ${entityType} (toegestaan: ${Object.keys(fieldMap).join(", ")})`
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
      .select("name") // SCHEMA-FIX-1: description bestaat niet; de hele select faalde
      .eq("id", tenantId)
      .single();

    const results: Array<{ entity_id: string; generated: string; field: string }> = [];

    if (entityType === 'category') {
      const { data: categories, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name, description")
        // SEC-SEO-1: service-role omzeilt RLS — beperk expliciet tot de eigen winkel.
        .eq("tenant_id", tenantId)
        .in("id", ids);

      if (categoriesError) throw categoriesError;

      for (const category of categories || []) {
        const generated = await generateContent(type, category, tenant, lovableApiKey, 'category');
        if (generated) {
          const { error: updateError } = await supabase
            .from("categories")
            .update({ [updateField]: generated })
            .eq("tenant_id", tenantId)
            .eq("id", category.id);

          if (updateError) {
            console.error(`SEO-CAT-1: update categories.${updateField} faalde voor ${category.id}:`, updateError);
          } else {
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
        .select("id, name, description, price, category_id, image_alt_texts")
        // SEC-SEO-1: service-role omzeilt RLS — beperk expliciet tot de eigen winkel.
        .eq("tenant_id", tenantId)
        .in("id", ids);

      if (productsError) throw productsError;

      for (const product of products || []) {
        const generated = await generateContent(type, product, tenant, lovableApiKey, 'product');
        if (generated) {
          // SEO-CAT-1: alt-tekst = hoofdafbeelding = index 0; de rest van het array blijft staan.
          let value: string | string[] = generated;
          if (updateField === "image_alt_texts") {
            const existing: unknown = product.image_alt_texts;
            value = Array.isArray(existing) && existing.length > 0
              ? [generated, ...(existing as string[]).slice(1)]
              : [generated];
          }

          const { error: updateError } = await supabase
            .from("products")
            .update({ [updateField]: value })
            .eq("tenant_id", tenantId)
            .eq("id", product.id);

          if (updateError) {
            console.error(`SEO-CAT-1: update products.${updateField} faalde voor ${product.id}:`, updateError);
          } else {
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

  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error("SEO Content Generator error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
