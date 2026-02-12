import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProductContext {
  name?: string;
  short_description?: string;
  description?: string;
  category_name?: string;
  price?: number;
  weight?: string | number;
  tags?: string[];
  specifications?: Record<string, string>;
  images?: string[];
  marketplace_channels?: string[]; // e.g. ['bol_com', 'amazon']
}

interface RequestBody {
  fieldType: string;
  currentValue: string;
  action: "auto_generate" | "briefing_generate" | "generate_variations" | "rewrite" | "shorter" | "longer";
  briefing?: string;
  language: string;
  productContext: ProductContext;
  existingTranslation?: string;
}

// Field-specific prompt config
function getFieldConfig(fieldType: string) {
  const configs: Record<string, { label: string; maxLength?: number; seoTips?: string }> = {
    product_title: { label: "producttitel", maxLength: 70 },
    short_description: { label: "korte productbeschrijving", maxLength: 300 },
    description: { label: "volledige productbeschrijving" },
    meta_title: { label: "SEO meta titel", maxLength: 60, seoTips: "Maximaal 60 tekens. Plaats het belangrijkste keyword aan het begin. Eindig met de merknaam als dat past." },
    meta_description: { label: "SEO meta beschrijving", maxLength: 160, seoTips: "Maximaal 160 tekens. Gebruik een call-to-action. Noem het belangrijkste voordeel. Gebruik het primaire keyword." },
    specification_value: { label: "specificatie waarde", maxLength: 200 },
    bullet_point: { label: "bullet point kenmerk", maxLength: 150 },
    category_description: { label: "categoriebeschrijving", maxLength: 500 },
    page_content: { label: "pagina-content" },
    newsletter: { label: "nieuwsbrief tekst" },
    campaign: { label: "campagne tekst" },
  };
  return configs[fieldType] || { label: fieldType };
}

const languageNames: Record<string, string> = {
  nl: "Nederlands",
  en: "Engels",
  fr: "Frans",
  de: "Duits",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    let tenantId: string | null = null;
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();
        tenantId = userRole?.tenant_id;
      }
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    const { fieldType, currentValue, action, briefing, language, productContext, existingTranslation } = body;
    const fieldConfig = getFieldConfig(fieldType);
    const langName = languageNames[language] || language;

    // Check if tenant is internal (unlimited credits)
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("name, is_internal_tenant")
      .eq("id", tenantId)
      .single();

    const isUnlimited = tenantData?.is_internal_tenant === true;
    const creditsNeeded = action === "generate_variations" ? 2 : 1;

    // Credit check (skip for unlimited tenants)
    if (!isUnlimited) {
      const { data: credits } = await supabase
        .from("tenant_ai_credits")
        .select("credits_total, credits_used, credits_purchased")
        .eq("tenant_id", tenantId)
        .single();

      const available = credits
        ? credits.credits_total + credits.credits_purchased - credits.credits_used
        : 0;

      if (available < creditsNeeded) {
        return new Response(
          JSON.stringify({ error: "Niet genoeg AI credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch tenant learning patterns
    const { data: learningPatterns } = await supabase
      .from("ai_learning_patterns")
      .select("pattern_type, learned_value, confidence_score")
      .eq("tenant_id", tenantId)
      .gte("confidence_score", 0.5);

    // Build system prompt
    const systemParts: string[] = [];
    systemParts.push(`Je bent een professionele ${langName}talige copywriter gespecialiseerd in e-commerce productteksten.`);
    systemParts.push(`Je schrijft in het ${langName}.`);

    if (tenantData?.name) {
      systemParts.push(`\nWEBSHOP: ${tenantData.name}`);
    }

    // Product context
    const ctx = productContext;
    if (ctx.name || ctx.category_name || ctx.price) {
      systemParts.push(`\nPRODUCT CONTEXT:`);
      if (ctx.name) systemParts.push(`- Naam: ${ctx.name}`);
      if (ctx.category_name) systemParts.push(`- Categorie: ${ctx.category_name}`);
      if (ctx.price) systemParts.push(`- Prijs: €${ctx.price}`);
      if (ctx.weight) systemParts.push(`- Gewicht: ${ctx.weight}`);
      if (ctx.tags?.length) systemParts.push(`- Tags: ${ctx.tags.join(", ")}`);
      if (ctx.short_description) systemParts.push(`- Korte beschrijving: ${ctx.short_description}`);
      if (ctx.specifications) {
        const specStr = Object.entries(ctx.specifications).map(([k, v]) => `${k}: ${v}`).join(", ");
        if (specStr) systemParts.push(`- Specificaties: ${specStr}`);
      }
    }

    // SEO tips
    if (fieldConfig.seoTips) {
      systemParts.push(`\nSEO RICHTLIJNEN:\n${fieldConfig.seoTips}`);
    }

    // Marketplace-aware guidelines
    const channels = ctx.marketplace_channels || [];
    if (channels.length > 0) {
      systemParts.push(`\nMARKETPLACE RICHTLIJNEN:`);
      if (channels.includes('bol_com')) {
        systemParts.push(`- Bol.com: Producttitel max 150 tekens. Gebruik het format: Merk + Productnaam + Belangrijkste kenmerk. Vermijd promotietekst in de titel.`);
        systemParts.push(`- Bol.com beschrijving: Gebruik bullet points voor kenmerken. Begin met het belangrijkste voordeel. Maximaal 2000 tekens.`);
      }
      if (channels.includes('amazon')) {
        systemParts.push(`- Amazon: Titel in Title Case, max 200 tekens. Format: Merk + Modelnaam + Type + Kleur/Variant.`);
        systemParts.push(`- Amazon beschrijving: Gebruik HTML bullet points (<ul><li>). Focus op features en benefits. Maximaal 2000 tekens.`);
        systemParts.push(`- Amazon bullet points: 5 kernpunten, elk max 500 tekens, begin elk punt met een hoofdletter.`);
      }
    }

    // Learning patterns
    if (learningPatterns?.length) {
      const relevant = learningPatterns.filter((p) => p.confidence_score >= 0.5);
      if (relevant.length > 0) {
        systemParts.push(`\nGELEERDE STIJLVOORKEUREN:`);
        relevant.forEach((p) => {
          const pref = (p.learned_value as any)?.preference;
          if (!pref || pref === "unchanged") return;
          if (p.pattern_type.includes("tone")) systemParts.push(`- Toon: ${pref}`);
          if (p.pattern_type.includes("length")) systemParts.push(`- Lengte voorkeur: ${pref}`);
        });
      }
    }

    systemParts.push(`\nAntwoord ALLEEN met de gegenereerde tekst, zonder aanhalingstekens, uitleg of extra opmaak.`);
    if (fieldType === "description") {
      systemParts.push(`Gebruik HTML opmaak met <h2>, <h3>, <p>, <ul>, <li> tags voor de productbeschrijving. Maak het visueel aantrekkelijk en goed gestructureerd.`);
    }

    const systemPrompt = systemParts.join("\n");

    // Build user prompt
    let userPrompt = "";
    const maxLenHint = fieldConfig.maxLength ? ` Maximaal ${fieldConfig.maxLength} tekens.` : "";

    switch (action) {
      case "auto_generate":
        userPrompt = `Genereer een ${fieldConfig.label} voor dit product.${maxLenHint}`;
        if (existingTranslation) {
          userPrompt += `\n\nGebruik de volgende tekst in een andere taal als inspiratie, maar schrijf het opnieuw in het ${langName} (geen letterlijke vertaling):\n"${existingTranslation}"`;
        }
        break;

      case "briefing_generate":
        userPrompt = `Genereer een ${fieldConfig.label} op basis van deze briefing: "${briefing}"${maxLenHint}`;
        break;

      case "generate_variations":
        userPrompt = `Genereer PRECIES 3 verschillende variaties van een ${fieldConfig.label} voor dit product.

Geef de output als een JSON array met exact deze structuur:
[
  {"style": "professional", "style_label": "Zakelijk", "text": "..."},
  {"style": "creative", "style_label": "Creatief", "text": "..."},
  {"style": "concise", "style_label": "Kort & Krachtig", "text": "..."}
]

${fieldType === "description" ? "Gebruik HTML opmaak (<h2>, <h3>, <p>, <ul>, <li>) in elke variant." : ""}
Antwoord ALLEEN met de JSON array, geen extra tekst.`;
        if (briefing) {
          userPrompt += `\n\nExtra instructie van de gebruiker: "${briefing}"`;
        }
        break;

      case "rewrite":
        userPrompt = `Herschrijf de volgende ${fieldConfig.label}: "${currentValue}"\n\nBehoud dezelfde intentie maar maak het beter.${maxLenHint}`;
        break;

      case "shorter":
        userPrompt = `Maak de volgende ${fieldConfig.label} korter maar behoud de essentie: "${currentValue}"`;
        break;

      case "longer":
        userPrompt = `Breid de volgende ${fieldConfig.label} uit met meer detail: "${currentValue}"`;
        break;
    }

    // Call AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: action === "generate_variations" || fieldType === "description" ? 1500 : 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit bereikt." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Geen AI credits meer." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content?.trim() || "";

    // Log usage & deduct credits
    await supabase.from("ai_usage_log").insert({
      tenant_id: tenantId,
      feature: "product_field_assistant",
      credits_used: creditsNeeded,
      model_used: "google/gemini-3-flash-preview",
      metadata: { fieldType, action, language },
    });

    if (!isUnlimited) {
      // Deduct credits properly
      const { data: currentCredits } = await supabase
        .from("tenant_ai_credits")
        .select("credits_used")
        .eq("tenant_id", tenantId)
        .single();

      if (currentCredits) {
        await supabase
          .from("tenant_ai_credits")
          .update({ credits_used: currentCredits.credits_used + creditsNeeded })
          .eq("tenant_id", tenantId);
      }
    }

    // Handle variations
    if (action === "generate_variations") {
      try {
        const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : generatedText;
        const parsed = JSON.parse(jsonStr) as Array<{ style: string; style_label: string; text: string }>;

        const variations = parsed.map((v, idx) => ({
          id: `var-${idx}-${Date.now()}`,
          text: v.text,
          style: v.style,
          style_label: v.style_label,
        }));

        return new Response(JSON.stringify({ variations }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ text: generatedText }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ text: generatedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ai-product-field-assistant:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
