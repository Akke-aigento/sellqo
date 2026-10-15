// SOCIAL-4b — "Taal veranderen" in de Social planning: de caption en de tekstvakken van de
// beelden van één post vertalen. De browser tekent daarna het beeld opnieuw (SOCIAL-4) en
// toont het resultaat; pas na "Bewaren" wordt iets opgeslagen. Deze functie schrijft niets
// in social_posts, ze vertaalt enkel.
//
// Invoer: { tenantId, postId, targetLanguage, texts: { [sleutel]: { text, max? } } }
//   sleutels: "caption" en "<beeldindex>:<slot>" (bv. "0:titel"). Max 60 teksten, 2200 tekens elk.
// Uitvoer: { translations: { [sleutel]: string } }
// Kost: 1 AI-credit per vertaling (vrijgestelde winkels niet).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { requireBillingState } from "../_shared/billingGuard.ts";
import { isBillingExempt } from "../_shared/billingExempt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const LANGUAGE_NAMES: Record<string, string> = {
  nl: "Dutch (Flemish, informal)",
  en: "English",
  fr: "French",
  de: "German",
  uk: "Ukrainian",
};
const MAX_TEXTS = 60;
const MAX_LEN = 2200;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = String(body?.tenantId ?? "");
    const postId = String(body?.postId ?? "");
    const target = String(body?.targetLanguage ?? "");
    const texts = (body?.texts ?? {}) as Record<string, { text?: unknown; max?: unknown }>;

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ["tenant_admin", "staff", "marketing"]);

    if (!LANGUAGE_NAMES[target]) return json({ error: "Onbekende taal." }, 400);
    const entries = Object.entries(texts).filter(([k, v]) =>
      /^(caption|\d{1,2}:[a-z0-9_-]{1,40})$/.test(k) && typeof v?.text === "string" && v.text.trim() !== ""
    );
    if (entries.length === 0) return json({ error: "Niets om te vertalen." }, 400);
    if (entries.length > MAX_TEXTS || entries.some(([, v]) => String(v.text).length > MAX_LEN)) {
      return json({ error: "Te veel of te lange teksten." }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await requireBillingState(admin, auth, tenantId, "marketing");

    // De post moet van deze winkel zijn (geen vertaaldienst voor willekeurige tekst).
    const { data: post } = await admin
      .from("social_posts")
      .select("id, language")
      .eq("id", postId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!post) return json({ error: "Post niet gevonden." }, 404);

    const { data: tenant } = await admin
      .from("tenants")
      .select("is_internal_tenant, billing_exempt")
      .eq("id", tenantId)
      .maybeSingle();
    if (!isBillingExempt(tenant)) {
      const { data: ok } = await admin.rpc("use_ai_credits", {
        p_tenant_id: tenantId,
        p_credits: 1,
        p_feature: "social_translate",
        p_model: MODEL,
        p_metadata: { post_id: postId, target },
      });
      if (!ok) return json({ error: "Onvoldoende AI-credits." }, 402);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Vertalen is niet geconfigureerd." }, 500);

    const source = LANGUAGE_NAMES[String(post.language ?? "")] ?? "the original language";
    const payload = Object.fromEntries(entries.map(([k, v]) => [k, {
      text: String(v.text),
      max: typeof v.max === "number" && v.max > 0 ? Math.floor(v.max) : null,
    }]));

    const system = [
      `You translate social media texts of a small brand from ${source} into ${LANGUAGE_NAMES[target]}.`,
      "Keep the tone and register of the original (informal stays informal), keep it natural for a native speaker.",
      "Do not translate brand names (e.g. Loveke), product names in English, URLs, @handles, prices or numbers.",
      "Keep emojis and line breaks. Hashtags: keep brand hashtags, translate generic ones only when natural.",
      "Each text has an optional max length in characters: the translation MUST NOT exceed it; shorten if needed.",
      'Answer ONLY with JSON: {"translations": {"<key>": "<translation>", ...}} with exactly the same keys.',
    ].join(" ");

    const res = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });
    if (res.status === 429) return json({ error: "Even te druk. Probeer het over een minuut opnieuw." }, 429);
    if (!res.ok) {
      console.error("[social-translate-post] gateway", res.status, await res.text());
      return json({ error: "Vertalen mislukt." }, 502);
    }
    const ai = await res.json();
    let parsed: { translations?: Record<string, unknown> } = {};
    try {
      parsed = JSON.parse(stripFences(String(ai?.choices?.[0]?.message?.content ?? "")));
    } catch {
      return json({ error: "Vertalen mislukt (onleesbaar antwoord)." }, 502);
    }

    const out: Record<string, string> = {};
    for (const [key, v] of Object.entries(payload)) {
      const t = parsed.translations?.[key];
      if (typeof t !== "string" || !t.trim()) return json({ error: `Vertaling ontbreekt voor ${key}.` }, 502);
      out[key] = v.max ? t.slice(0, v.max) : t;
    }
    return json({ translations: out });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    console.error("[social-translate-post]", (err as Error).message);
    return json({ error: "Er ging iets mis." }, 500);
  }
});
