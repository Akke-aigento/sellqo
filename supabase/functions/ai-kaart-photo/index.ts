// KAART-2 — foto van een menukaart → voorstel van producten (naam, prijs, categorie).
//
// Er wordt hier NIETS aangemaakt: de app toont het voorstel, de gebruiker kijkt na en voegt
// toe via kaart_add_products. Kosten: KAART_PHOTO_CREDITS per foto, zoals de andere AI-
// functies "betalen na succes": eerst nagaan of er genoeg credits zijn, dan de AI, dan
// afboeken (use_ai_credits, atomair). Lukt het afboeken niet, dan geven we het resultaat
// ook niet terug. Een mislukte AI-call kost dus niets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { requireBillingState } from "../_shared/billingGuard.ts";
import { isBillingExempt } from "../_shared/billingExempt.ts";
import {
  KAART_PHOTO_CREDITS,
  KAART_PHOTO_MODEL,
  kaartPhotoPrompt,
  parseKaartPhotoResponse,
  validImage,
} from "../_shared/kaartPhoto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // Neveneffectvrije versiestempel om een deploy te bewijzen.
  if (req.method === "GET") return json({ ok: true, version: "KAART-2" });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => null) as { tenantId?: string; image?: unknown; language?: string } | null;
    const tenantId = body?.tenantId;
    if (!tenantId || !/^[0-9a-f-]{36}$/.test(tenantId)) return json({ error: "tenantId ontbreekt", code: "bad_request" }, 400);

    const auth = await authenticateRequest(req, tenantId);
    // Zelfde rollen als kaart_add_products: wie de kaart mag vullen, mag ook een foto laten lezen.
    requireRole(auth, tenantId, ["tenant_admin", "staff"]);
    await requireBillingState(supabase, auth, tenantId, "ai_kaart_photo");

    if (!validImage(body?.image)) return json({ error: "Enkel een jpeg-, png- of webp-foto tot ±6 MB.", code: "bad_image" }, 400);
    const language = typeof body?.language === "string" ? body.language.slice(0, 5) : "nl";

    // Genoeg credits? (vrijgestelde winkels: altijd; use_ai_credits logt daar met aftrek 0.)
    const { data: tenant } = await supabase.from("tenants").select("is_internal_tenant, billing_exempt").eq("id", tenantId).maybeSingle();
    if (!isBillingExempt(tenant)) {
      const { data: credits } = await supabase.from("tenant_ai_credits")
        .select("credits_total, credits_used, credits_purchased").eq("tenant_id", tenantId).maybeSingle();
      const available = credits ? credits.credits_total + credits.credits_purchased - credits.credits_used : 0;
      if (available < KAART_PHOTO_CREDITS) {
        return json({ error: "Niet genoeg AI-credits.", code: "no_credits", needed: KAART_PHOTO_CREDITS, available }, 402);
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: KAART_PHOTO_MODEL,
        messages: [
          { role: "system", content: kaartPhotoPrompt(language) },
          { role: "user", content: [
            { type: "text", text: "Lees deze kaart." },
            { type: "image_url", image_url: { url: body!.image as string } },
          ] },
        ],
        max_tokens: 8000,
        temperature: 0.1,
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("ai-kaart-photo gateway", response.status, errText.slice(0, 300));
      if (response.status === 429) return json({ error: "Even te druk, probeer zo opnieuw.", code: "rate_limited" }, 429);
      return json({ error: "De foto kon niet gelezen worden.", code: "ai_failed" }, 502);
    }
    const data = await response.json();
    const items = parseKaartPhotoResponse(String(data?.choices?.[0]?.message?.content ?? ""));
    if (!items) return json({ error: "De foto kon niet gelezen worden.", code: "ai_failed" }, 502);
    if (!items.length) return json({ error: "Geen producten gevonden op de foto.", code: "empty" }, 422);

    // Pas nu afboeken. Lukt dat niet (net te weinig credits door een andere call), dan
    // geven we het resultaat niet: geen gratis lezing.
    const { data: charged, error: chargeErr } = await supabase.rpc("use_ai_credits", {
      p_tenant_id: tenantId,
      p_credits: KAART_PHOTO_CREDITS,
      p_feature: "kaart_photo",
      p_model: KAART_PHOTO_MODEL,
      p_metadata: { items: items.length, language, user_id: auth.user_id },
    });
    if (chargeErr || charged !== true) {
      if (chargeErr) console.error("use_ai_credits failed:", chargeErr.message);
      return json({ error: "Niet genoeg AI-credits.", code: "no_credits", needed: KAART_PHOTO_CREDITS }, 402);
    }

    return json({ items, credits: KAART_PHOTO_CREDITS });
  } catch (e) {
    if (e instanceof AuthError) {
      // requireBillingState: leesmodus (402), te onderscheiden van "geen credits".
      if (e.status === 402) return json({ error: e.message, code: "billing" }, 402);
      return authErrorResponse(e, corsHeaders);
    }
    console.error("ai-kaart-photo", e);
    return json({ error: "Er ging iets mis.", code: "server" }, 500);
  }
});
