import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import {
  authenticateRequest,
  requireRole,
  AuthError,
  authErrorResponse,
} from "../_shared/auth.ts";
import {
  CATEGORY_PROMPT_BY_KEY,
  FORMAT_EMPHASIS_GUIDANCE,
  CARD_FORMATS,
} from "../_shared/contentCategories.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

/**
 * Vaste prijs voor een heel menu, ongeacht het aantal kaarten.
 *
 * Bewust niet 2 credits per kaart zoals ai-generate-social: Pro heeft 500
 * credits per maand (migratie 20260127101317:132). Bij acht kaarten zou
 * per-kaart-afrekenen 480 credits per maand kosten en de hele maand in z'n
 * eentje leegtrekken. Beeld wordt daarom ook niet automatisch gegenereerd —
 * dat gaat per kaart via ai-generate-image, op het moment dat de tenant die
 * kaart daadwerkelijk wil gebruiken.
 */
const MENU_CREDITS = 5;

/** Runaway-rem. Een tenant kan per categorie maximaal 5 kiezen in de UI. */
const MAX_SLOTS = 20;

const languageInstructions: Record<string, string> = {
  nl: "Schrijf in het Nederlands (informeel, Vlaams/Nederlands)",
  en: "Write in English (British English preferred)",
  de: "Schreibe auf Deutsch",
  fr: "Écris en français",
  uk: "Пиши українською мовою",
};

interface DailyMenuRequest {
  tenantId: string;
  language?: string;
}

interface MenuSlot {
  categoryKey: string;
  categoryLabel: string;
  instruction: string;
  isCustom: boolean;
  isFreeform: boolean;
}

/** Eén kaart zoals het model hem teruggeeft. */
interface GeneratedCard {
  category_key?: string;
  title?: string;
  caption?: string;
  hashtags?: string[];
  card_format?: string;
  format_reason?: string;
  platform?: string;
  image_prompt?: string;
  angle_reason?: string;
  product_ids?: string[];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { tenantId, language = "nl" }: DailyMenuRequest = await req.json();
    if (!tenantId) return jsonResponse({ error: "Missing tenantId" }, 400);

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ["tenant_admin", "staff", "marketing"]);

    // ---------- 1. Merk-DNA en categorieën ----------
    const [dnaResult, categoriesResult] = await Promise.all([
      supabase.from("tenant_brand_dna").select("*").eq("tenant_id", tenantId).maybeSingle(),
      supabase
        .from("tenant_content_categories")
        .select("slug, name, instructions, sort_order")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    const dna = dnaResult.data;
    if (!dna) {
      // Eigen code zodat de UI "vul eerst je merk-DNA in" kan tonen in plaats
      // van een generieke foutmelding.
      return jsonResponse({ error: "brand_dna_missing", code: "brand_dna_missing" }, 409);
    }

    const customCategories = categoriesResult.data ?? [];

    // ---------- 2. Slotlijst uit menu_counts ----------
    const counts: Record<string, number> = (dna.menu_counts ?? {}) as Record<string, number>;
    const slots: MenuSlot[] = [];

    for (const [key, prompt] of Object.entries(CATEGORY_PROMPT_BY_KEY)) {
      const n = Number(counts[key] ?? 0);
      for (let i = 0; i < n && slots.length < MAX_SLOTS; i++) {
        slots.push({
          categoryKey: key,
          categoryLabel: key,
          instruction: prompt.instruction,
          isCustom: false,
          isFreeform: !!prompt.isFreeform,
        });
      }
    }

    for (const category of customCategories) {
      const n = Number(counts[category.slug] ?? 0);
      for (let i = 0; i < n && slots.length < MAX_SLOTS; i++) {
        slots.push({
          categoryKey: category.slug,
          categoryLabel: category.name,
          instruction: category.instructions,
          isCustom: true,
          isFreeform: false,
        });
      }
    }

    if (slots.length === 0) {
      return jsonResponse({ error: "menu_empty", code: "menu_empty" }, 422);
    }

    // ---------- 3. Credits ----------
    const { data: hasCredits } = await supabase.rpc("use_ai_credits", {
      p_tenant_id: tenantId,
      p_credits: MENU_CREDITS,
      p_feature: "daily_menu",
      p_model: MODEL,
      p_metadata: { slots: slots.length, format_emphasis: dna.format_emphasis },
    });

    if (!hasCredits) {
      return jsonResponse({ error: "Onvoldoende AI credits", code: "insufficient_credits" }, 402);
    }

    // ---------- 4. Winkelcontext ----------
    const [productsResult, pagesResult, tenantResult] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, slug, short_description, description, price, compare_at_price, tags, featured_image, is_featured, stock, created_at")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .neq("hide_from_storefront", true)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("storefront_pages")
        .select("title, slug, content")
        .eq("tenant_id", tenantId)
        .eq("is_published", true)
        .limit(10),
      supabase.from("tenants").select("name, country, currency").eq("id", tenantId).single(),
    ]);

    const products = productsResult.data ?? [];
    const pages = pagesResult.data ?? [];
    const tenant = tenantResult.data;

    // Wat er speelt: nieuw binnen, bijna op, uitgelicht. Zelfde signalen als
    // ai-marketing-context, hier lokaal afgeleid zodat er geen tweede
    // functie-aanroep nodig is.
    const newArrivals = products.slice(0, 5);
    const lowStock = products
      .filter((p: Record<string, unknown>) => typeof p.stock === "number" && (p.stock as number) > 0 && (p.stock as number) <= 5)
      .slice(0, 5);
    const featured = products.filter((p: Record<string, unknown>) => p.is_featured).slice(0, 5);

    const now = new Date();
    const monthNames = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
    const seasons = ["winter", "winter", "lente", "lente", "lente", "zomer", "zomer", "zomer", "herfst", "herfst", "herfst", "winter"];

    // ---------- 5. Prompt ----------
    const hashtagSets = (dna.hashtag_sets ?? {}) as Record<string, string[]>;

    const systemPrompt = `Je bent de vaste social-media-redacteur van ${tenant?.name ?? "deze winkel"}.
${languageInstructions[language] ?? languageInstructions.nl}

MERK-DNA — dit is wie het merk is. Alles wat je schrijft moet hierbij passen.
- Missie: ${dna.brand_mission || "niet ingevuld"}
- Doelgroep: ${dna.target_audience || "niet ingevuld"}
- Tone of voice: ${(dna.tone_keywords ?? []).join(", ") || "niet ingevuld"}
- Sterke punten: ${(dna.usps ?? []).join(" | ") || "niet ingevuld"}
- Vaste thema's: ${(dna.themes ?? []).join(", ") || "niet ingevuld"}
- WEL doen: ${dna.dos || "niets specifieks opgegeven"}
- NIET doen: ${dna.donts || "niets specifieks opgegeven"}
- Extra achtergrond: ${dna.free_dna || "geen"}

HASHTAG-VOORRAAD (hergebruik hieruit waar het past, vul aan waar nodig):
${Object.entries(hashtagSets).map(([name, tags]) => `- ${name}: ${(tags ?? []).join(" ")}`).join("\n") || "- geen sets ingevuld"}

FORMAAT-NADRUK: ${FORMAT_EMPHASIS_GUIDANCE[dna.format_emphasis] ?? FORMAT_EMPHASIS_GUIDANCE.mixed}

HARDE REGELS
- Gebruik uitsluitend producten, prijzen en feiten uit de meegeleverde context. Verzin niets.
- Geen onverifieerbare superlatieven of claims ("de beste", "gegarandeerd goedkoopst"). Belgische
  regels rond misleidende handelspraktijken gelden hier.
- Geen verzonnen klantcitaten of beoordelingen die als echt worden gepresenteerd.
- Respecteer de NIET-doen-lijst hierboven strikt.
- Elke kaart moet een eigen invalshoek hebben; herhaal geen andere kaart uit dit menu.`;

    const contextBlock = `WINKELCONTEXT
Bedrijf: ${tenant?.name ?? "onbekend"} (${tenant?.country ?? "?"}, valuta ${tenant?.currency ?? "EUR"})
Vandaag: ${now.getDate()} ${monthNames[now.getMonth()]}, seizoen ${seasons[now.getMonth()]}

NIEUW BINNEN:
${newArrivals.map((p: Record<string, unknown>) => `- [${p.id}] ${p.name} — €${p.price}${p.short_description ? ` — ${p.short_description}` : ""}`).join("\n") || "- geen"}

BIJNA UITVERKOCHT:
${lowStock.map((p: Record<string, unknown>) => `- [${p.id}] ${p.name} — nog ${p.stock} stuks — €${p.price}`).join("\n") || "- geen"}

UITGELICHT:
${featured.map((p: Record<string, unknown>) => `- [${p.id}] ${p.name} — €${p.price}`).join("\n") || "- geen"}

VOLLEDIG ASSORTIMENT (selectie):
${products.slice(0, 25).map((p: Record<string, unknown>) => `- [${p.id}] ${p.name} — €${p.price}${p.tags && (p.tags as string[]).length ? ` — tags: ${(p.tags as string[]).join(", ")}` : ""}`).join("\n") || "- geen producten"}

WEBSHOP-PAGINA'S (achtergrondkennis over het merk):
${pages.map((p: Record<string, unknown>) => `- ${p.title}: ${String(p.content ?? "").replace(/<[^>]+>/g, " ").slice(0, 300)}`).join("\n") || "- geen"}`;

    const slotBlock = slots
      .map((slot, i) => `KAART ${i + 1} — categorie \`${slot.categoryKey}\`${slot.isCustom ? " (eigen categorie van de tenant)" : ""}
Opdracht: ${slot.instruction}`)
      .join("\n\n");

    const userPrompt = `${contextBlock}

MAAK PRECIES ${slots.length} KAARTEN, in deze volgorde:

${slotBlock}

Antwoord ALLEEN met een JSON-object, zonder markdown of backticks:
{
  "cards": [
    {
      "category_key": "de key van de kaart zoals hierboven gegeven",
      "title": "korte werktitel voor intern gebruik",
      "caption": "de volledige post-tekst",
      "hashtags": ["#voorbeeld", "#tweede"],
      "card_format": "post | reel | story | carousel",
      "format_reason": "één zin waarom dit formaat past",
      "platform": "instagram | facebook | linkedin | twitter",
      "image_prompt": "Engelse beschrijving voor een beeldgenerator, zonder tekst in beeld",
      "angle_reason": "alleen bij surprise_me: één zin over de gekozen invalshoek",
      "product_ids": ["uuid van een genoemd product, indien van toepassing"]
    }
  ]
}`;

    // ---------- 6. Eén AI-call voor alle kaarten ----------
    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 900 + slots.length * 400,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      if (response.status === 429) {
        return jsonResponse({ error: "Rate limit overschreden", code: "rate_limit" }, 429);
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const raw = (aiResult.choices?.[0]?.message?.content ?? "")
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let parsed: { cards?: GeneratedCard[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Laatste redmiddel: het eerste JSON-object uit de tekst vissen.
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        console.error("Onparseerbaar AI-antwoord:", raw.slice(0, 500));
        throw new Error("Failed to parse AI response");
      }
      parsed = JSON.parse(match[0]);
    }

    const cards = Array.isArray(parsed.cards) ? parsed.cards : [];

    // ---------- 7. Valideren en wegschrijven ----------
    const menuRunId = crypto.randomUUID();
    const productIds = new Set(products.map((p: Record<string, unknown>) => p.id as string));
    const rows: Record<string, unknown>[] = [];
    let skipped = 0;

    cards.forEach((card, index) => {
      const caption = (card.caption ?? "").trim();
      if (!caption) {
        skipped++;
        return;
      }

      // Slot als bron van waarheid voor de categorie: het model mag de volgorde
      // niet stilzwijgend omgooien.
      const slot = slots[index] ?? slots[slots.length - 1];
      const format = CARD_FORMATS.includes(card.card_format as never)
        ? (card.card_format as string)
        : "post";

      // Alleen product-ids die echt bestaan; een gehallucineerde uuid zou een
      // foreign-key-achtige verwarring geven in de UI.
      const validProductIds = (card.product_ids ?? []).filter((id) => productIds.has(id));

      rows.push({
        tenant_id: tenantId,
        content_type: "menu_card",
        platform: card.platform ?? "instagram",
        title: (card.title ?? slot.categoryLabel).slice(0, 200),
        content_text: caption,
        product_ids: validProductIds,
        language,
        metadata: {
          menu_run_id: menuRunId,
          card_index: index,
          category_key: slot.categoryKey,
          category_label: slot.categoryLabel,
          is_custom: slot.isCustom,
          is_freeform: slot.isFreeform,
          card_format: format,
          format_reason: card.format_reason ?? null,
          hashtags: Array.isArray(card.hashtags) ? card.hashtags : [],
          image_prompt: card.image_prompt ?? null,
          angle_reason: card.angle_reason ?? null,
          source: "daily_menu",
        },
      });
    });

    if (rows.length === 0) {
      return jsonResponse({ error: "no_usable_cards", code: "no_usable_cards" }, 502);
    }

    const { data: saved, error: saveError } = await supabase
      .from("ai_generated_content")
      .insert(rows)
      .select();

    if (saveError) {
      console.error("Error saving menu cards:", saveError);
      throw new Error(`Failed to save menu cards: ${saveError.message}`);
    }

    return jsonResponse({
      menuRunId,
      cards: saved,
      requested: slots.length,
      generated: rows.length,
      skipped,
      creditsUsed: MENU_CREDITS,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error("Error in ai-generate-daily-menu:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
