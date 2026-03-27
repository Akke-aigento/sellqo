import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Required fields per page type
const REQUIRED_FIELDS: Record<string, string[]> = {
  _base: ["name", "owner_email", "address", "city", "postal_code", "country"],
  privacy: ["btw_number"],
  cookie: ["btw_number"],
  terms: ["iban"],
  refund: [],
  shipping: [],
  contact: ["phone"],
  legal_notice: ["kvk_number", "btw_number"],
};

const FIELD_LABELS: Record<string, string> = {
  name: "Bedrijfsnaam",
  owner_email: "E-mailadres",
  address: "Adres",
  city: "Stad",
  postal_code: "Postcode",
  country: "Land",
  btw_number: "BTW-nummer",
  kvk_number: "KvK-nummer",
  iban: "IBAN",
  phone: "Telefoonnummer",
};

const PAGE_NAMES: Record<string, { nl: string; en: string }> = {
  privacy: { nl: "Privacybeleid", en: "Privacy Policy" },
  terms: { nl: "Algemene Voorwaarden", en: "Terms of Service" },
  refund: { nl: "Retourbeleid", en: "Refund Policy" },
  shipping: { nl: "Verzendbeleid", en: "Shipping Policy" },
  contact: { nl: "Contactgegevens", en: "Contact Information" },
  legal_notice: { nl: "Juridische Kennisgeving", en: "Legal Notice" },
  cookie: { nl: "Cookiebeleid", en: "Cookie Policy" },
};

function validateTenantFields(tenant: any, pageTypes: string[]): { canGenerate: string[]; missingFieldsByPage: Record<string, string[]> } {
  const baseFields = REQUIRED_FIELDS._base;
  const missingBase = baseFields.filter(f => !tenant[f] || String(tenant[f]).trim() === "");

  const canGenerate: string[] = [];
  const missingFieldsByPage: Record<string, string[]> = {};

  for (const pt of pageTypes) {
    const extra = REQUIRED_FIELDS[pt] || [];
    const missingExtra = extra.filter(f => !tenant[f] || String(tenant[f]).trim() === "");
    const allMissing = [...new Set([...missingBase, ...missingExtra])];

    if (allMissing.length === 0) {
      canGenerate.push(pt);
    } else {
      missingFieldsByPage[pt] = allMissing;
    }
  }

  return { canGenerate, missingFieldsByPage };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, page_types } = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tenant data
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(JSON.stringify({ error: "Tenant niet gevonden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allPageTypes = Object.keys(PAGE_NAMES);
    const requestedTypes: string[] = page_types && page_types.length > 0 ? page_types : allPageTypes;

    // Validate
    const { canGenerate, missingFieldsByPage } = validateTenantFields(tenant, requestedTypes);

    if (canGenerate.length === 0) {
      // Convert missing fields to readable labels
      const readableMissing: Record<string, string[]> = {};
      for (const [pt, fields] of Object.entries(missingFieldsByPage)) {
        readableMissing[PAGE_NAMES[pt]?.nl || pt] = fields.map(f => FIELD_LABELS[f] || f);
      }
      return new Response(JSON.stringify({
        error: "missing_fields",
        message: "Niet alle vereiste bedrijfsgegevens zijn ingevuld",
        missingFieldsByPage: readableMissing,
        missingFields: [...new Set(Object.values(missingFieldsByPage).flat())].map(f => FIELD_LABELS[f] || f),
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build AI prompt
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI is niet geconfigureerd" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantInfo = {
      bedrijfsnaam: tenant.name,
      email: tenant.owner_email,
      adres: `${tenant.address}, ${tenant.postal_code} ${tenant.city}, ${tenant.country}`,
      kvk: tenant.kvk_number || "Niet opgegeven",
      btw: tenant.btw_number || "Niet opgegeven",
      iban: tenant.iban || "Niet opgegeven",
      telefoon: tenant.phone || "Niet opgegeven",
      website: tenant.website || tenant.slug ? `https://sellqo.lovable.app/shop/${tenant.slug}` : "Niet opgegeven",
    };

    const pagesToGenerate = canGenerate.map(pt => `- ${PAGE_NAMES[pt].nl} (${pt})`).join("\n");

    const systemPrompt = `Je bent een juridisch tekstschrijver gespecialiseerd in e-commerce wetgeving voor Nederlandse en Belgische webshops. 
Je schrijft professionele, complete juridische pagina's die voldoen aan de AVG/GDPR, het Europees consumentenrecht en de Nederlandse/Belgische wetgeving.

Belangrijk:
- Schrijf in de derde persoon ("het bedrijf" of gebruik de bedrijfsnaam)
- Gebruik duidelijke koppen en paragrafen met HTML-opmaak (<h2>, <h3>, <p>, <ul>, <li>)
- Wees specifiek en concreet, geen vage formuleringen
- Verwijs naar relevante wetgeving (AVG, BW, Wet Koop op Afstand, etc.)
- Maak de teksten compliant maar ook leesbaar voor consumenten`;

    const userPrompt = `Genereer juridische pagina's voor de volgende webshop:

Bedrijfsgegevens:
${JSON.stringify(tenantInfo, null, 2)}

Genereer de volgende pagina's:
${pagesToGenerate}

Antwoord in het volgende JSON-formaat (gebruik tool calling):
Voor elke pagina: content_nl (Nederlands, HTML), content_en (Engels, HTML).
De content moet professioneel, compleet en juridisch correct zijn.`;

    const toolSchema = {
      type: "function" as const,
      function: {
        name: "save_legal_pages",
        description: "Save the generated legal pages content",
        parameters: {
          type: "object",
          properties: {
            pages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  page_type: { type: "string", enum: canGenerate },
                  content_nl: { type: "string", description: "Full HTML content in Dutch" },
                  content_en: { type: "string", description: "Full HTML content in English" },
                },
                required: ["page_type", "content_nl", "content_en"],
                additionalProperties: false,
              },
            },
          },
          required: ["pages"],
          additionalProperties: false,
        },
      },
    };

    console.log(`Generating legal pages for tenant ${tenant_id}: ${canGenerate.join(", ")}`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "save_legal_pages" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit bereikt, probeer het later opnieuw" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits op, voeg credits toe in je workspace" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generatie mislukt" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "AI gaf geen geldig antwoord" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pages } = JSON.parse(toolCall.function.arguments);
    if (!pages || !Array.isArray(pages)) {
      return new Response(JSON.stringify({ error: "AI gaf geen geldige pagina's" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert pages into legal_pages
    let created = 0;
    let updated = 0;
    for (const page of pages) {
      const pageInfo = PAGE_NAMES[page.page_type];
      if (!pageInfo) continue;

      // Check if page already exists
      const { data: existing } = await supabase
        .from("legal_pages")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("page_type", page.page_type)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("legal_pages")
          .update({
            content_nl: page.content_nl,
            content_en: page.content_en,
            is_auto_generated: true,
            last_auto_generated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        updated++;
      } else {
        await supabase
          .from("legal_pages")
          .insert({
            tenant_id,
            page_type: page.page_type,
            title_nl: pageInfo.nl,
            title_en: pageInfo.en,
            content_nl: page.content_nl,
            content_en: page.content_en,
            is_published: false,
            is_auto_generated: true,
            last_auto_generated_at: new Date().toISOString(),
          });
        created++;
      }
    }

    // Return result including which pages couldn't be generated
    const result: any = {
      success: true,
      generated: canGenerate,
      created,
      updated,
    };

    if (Object.keys(missingFieldsByPage).length > 0) {
      result.skipped = {};
      for (const [pt, fields] of Object.entries(missingFieldsByPage)) {
        result.skipped[PAGE_NAMES[pt]?.nl || pt] = fields.map(f => FIELD_LABELS[f] || f);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-legal-pages error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
