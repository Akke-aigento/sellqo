import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, type, productIds } = await req.json();
    
    if (!tenantId || !type || !productIds || productIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "tenantId, type, and productIds are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate credits needed (1 per product)
    const creditsNeeded = productIds.length;

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

    // Fetch products
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, description, price, category_id")
      .in("id", productIds);

    if (productsError) throw productsError;

    // Fetch tenant info for context
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, description")
      .eq("id", tenantId)
      .single();

    const results: Array<{ product_id: string; generated: string; field: string }> = [];

    // Generate content for each product
    for (const product of products || []) {
      let systemPrompt = "";
      let userPrompt = "";

      switch (type) {
        case "meta_title":
          systemPrompt = `Je bent een SEO-expert die meta titles schrijft. 
Regels:
- Max 60 tekens
- Bevat het belangrijkste keyword (productnaam)
- Aantrekkelijk voor klikken
- Uniek per product
- Nederlands taalgebruik`;
          userPrompt = `Schrijf een meta title voor dit product:
Naam: ${product.name}
Beschrijving: ${product.description?.substring(0, 200) || 'Geen beschrijving'}
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
          userPrompt = `Schrijf een meta description voor dit product:
Naam: ${product.name}
Beschrijving: ${product.description?.substring(0, 300) || 'Geen beschrijving'}
Prijs: €${product.price || 0}
Winkel: ${tenant?.name || 'Webshop'}

Geef alleen de meta description terug, geen uitleg.`;
          break;

        case "product_description":
          systemPrompt = `Je bent een copywriter die productbeschrijvingen optimaliseert voor SEO.
Regels:
- Minimaal 150 woorden
- Gebruik relevante keywords natuurlijk
- Structureer met bullet points waar nodig
- Vermeld voordelen en features
- Nederlands taalgebruik
- Schrijf voor de doelgroep, niet alleen voor zoekmachines`;
          userPrompt = `Herschrijf en optimaliseer deze productbeschrijving voor SEO:
Naam: ${product.name}
Huidige beschrijving: ${product.description || 'Geen beschrijving - schrijf een nieuwe'}
Winkel: ${tenant?.name || 'Webshop'}

Geef alleen de nieuwe beschrijving terug.`;
          break;

        case "alt_text":
          systemPrompt = `Je bent een SEO-expert die alt-teksten schrijft voor productafbeeldingen.
Regels:
- Max 125 tekens
- Beschrijf wat er op de afbeelding te zien is
- Bevat het productnaam
- Geen "afbeelding van" of "foto van"
- Nederlands taalgebruik`;
          userPrompt = `Schrijf een alt-tekst voor de hoofdafbeelding van dit product:
Naam: ${product.name}
Beschrijving: ${product.description?.substring(0, 200) || 'Geen beschrijving'}

Geef alleen de alt-tekst terug, geen uitleg.`;
          break;

        default:
          continue;
      }

      // Call Lovable AI
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
        console.error(`AI error for product ${product.id}:`, await aiResponse.text());
        continue;
      }

      const aiData = await aiResponse.json();
      const generatedContent = aiData.choices?.[0]?.message?.content?.trim() || "";

      if (generatedContent) {
        // Update the product with the generated content
        const updateField = type === "product_description" ? "description" : type;
        
        const { error: updateError } = await supabase
          .from("products")
          .update({ [updateField]: generatedContent })
          .eq("id", product.id);

        if (!updateError) {
          results.push({
            product_id: product.id,
            generated: generatedContent,
            field: updateField,
          });
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
          products_processed: results.length,
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
