import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  fieldType: 'title' | 'subtitle' | 'cta' | 'button' | 'description';
  sectionType: 'hero' | 'newsletter' | 'text_image' | 'featured_products' | 'testimonials';
  currentValue?: string;
  action: 'generate' | 'rewrite' | 'shorter' | 'longer';
  tenantContext?: {
    businessName?: string;
    industry?: string;
    tone?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get tenant from auth
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let tenantId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();
        tenantId = userRole?.tenant_id;
      }
    }

    const { fieldType, sectionType, currentValue, action, tenantContext }: GenerateRequest = await req.json();

    // Build the prompt based on field type, section type, and action
    const prompts: Record<string, Record<string, string>> = {
      hero: {
        title: "een krachtige, aandachttrekkende hero titel voor een webshop homepage",
        subtitle: "een ondersteunende subtitel die de waardepropositie verduidelijkt",
        cta: "een overtuigende call-to-action knoptekst",
        button: "een korte, actiegerichte knoptekst",
      },
      newsletter: {
        title: "een uitnodigende titel voor een nieuwsbrief aanmeldsectie",
        subtitle: "een korte beschrijving waarom mensen zich moeten aanmelden",
        button: "een aanmoedigende aanmeldknoptekst",
      },
      text_image: {
        title: "een pakkende sectietitel",
        subtitle: "een informatieve ondertitel",
        description: "een overtuigende paragraaf",
        button: "een relevante call-to-action",
      },
      featured_products: {
        title: "een aantrekkelijke titel voor uitgelichte producten",
        subtitle: "een korte introductie voor de productenselectie",
      },
      testimonials: {
        title: "een vertrouwenwekkende titel voor de reviews sectie",
        subtitle: "een korte introductie voor klantbeoordelingen",
      },
    };

    const fieldDescription = prompts[sectionType]?.[fieldType] || `een ${fieldType} voor een ${sectionType} sectie`;

    let systemPrompt = `Je bent een Nederlandse copywriter gespecialiseerd in e-commerce en webshops. 
Je schrijft beknopte, pakkende teksten die conversie stimuleren.
Gebruik een professionele maar toegankelijke toon.
${tenantContext?.businessName ? `De webshop heet "${tenantContext.businessName}".` : ''}
${tenantContext?.industry ? `De branche is: ${tenantContext.industry}.` : ''}
${tenantContext?.tone ? `De gewenste toon is: ${tenantContext.tone}.` : ''}

Antwoord ALLEEN met de gegenereerde tekst, zonder aanhalingstekens, uitleg of extra opmaak.`;

    let userPrompt = '';
    
    switch (action) {
      case 'generate':
        userPrompt = `Genereer ${fieldDescription}.${fieldType === 'title' ? ' Maximaal 8 woorden.' : fieldType === 'subtitle' ? ' Maximaal 15 woorden.' : fieldType === 'cta' || fieldType === 'button' ? ' Maximaal 3 woorden.' : ' Maximaal 25 woorden.'}`;
        break;
      case 'rewrite':
        userPrompt = `Herschrijf de volgende tekst professioneler en overtuigender: "${currentValue}"\n\nBehoud dezelfde lengte en intentie.`;
        break;
      case 'shorter':
        userPrompt = `Maak de volgende tekst korter maar behoud de essentie: "${currentValue}"\n\nMaximaal de helft van de originele lengte.`;
        break;
      case 'longer':
        userPrompt = `Breid de volgende tekst uit met meer detail of overtuigingskracht: "${currentValue}"\n\nMaak het ongeveer 50% langer.`;
        break;
    }

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
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit bereikt. Probeer het later opnieuw." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Geen AI credits meer beschikbaar." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content?.trim() || "";

    // Log AI usage if tenant is identified
    if (tenantId) {
      await supabase.from("ai_usage_log").insert({
        tenant_id: tenantId,
        feature: "storefront_copy",
        credits_used: 1,
        model_used: "google/gemini-3-flash-preview",
        metadata: { fieldType, sectionType, action },
      });

      // Use credits
      await supabase.rpc("use_ai_credits", {
        p_tenant_id: tenantId,
        p_credits_needed: 1,
      });
    }

    return new Response(
      JSON.stringify({ text: generatedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-generate-storefront-copy:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
