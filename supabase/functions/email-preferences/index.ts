import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifyMarketingLink } from "../_shared/marketingToken.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { getShopInfo, isJsonRequest, jsonResponse, pickParams, redirectToApp } from "../_shared/mailPages.ts";

/**
 * MAIL-1a — mailvoorkeuren. MAIL-1c — pagina verhuisd naar sellqo.app/mail/voorkeuren.
 *
 * - Browser-GET (link in een mail): 302 naar /mail/voorkeuren met dezelfde
 *   parameters. Deze functie rendert geen HTML meer: Supabase serveert die als
 *   text/plain.
 * - POST met `Content-Type: application/json`: API voor die pagina, acties `get`
 *   en `save`. Beide vragen een geldige handtekening (`s`) over (tenant, e-mail);
 *   zonder: niets gelezen of aangemaakt.
 * - Opslaan zet customers.email_subscribed NOOIT op true: opnieuw inschrijven via
 *   deze pagina is geen geldige toestemming (geen double opt-in). Alles uitzetten
 *   zet hem wel op false.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_FREQUENCIES = new Set(["normal", "weekly", "minimal"]);

const FORWARD_KEYS = ["tenant", "email", "s", "lang"] as const;

/** ilike zonder wildcards: `_` en `%` in een adres mogen niet op andere adressen matchen. */
const ilikeExact = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

const str = (v: unknown): string | null => (typeof v === "string" && v.length <= 512 ? v : null);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") return handleCorsOptions(req);

  // Browser-GET vanuit een mail: naar de pagina op sellqo.app. Leest niets.
  if (req.method === "GET") {
    return redirectToApp("/mail/voorkeuren", pickParams(url, FORWARD_KEYS));
  }

  if (req.method !== "POST" || !isJsonRequest(req)) {
    return jsonResponse({ ok: false, error: "unsupported" }, 415, cors);
  }

  try {
    // deno-lint-ignore no-explicit-any
    let b: Record<string, any> = {};
    try {
      const parsed = await req.json();
      if (parsed && typeof parsed === "object") b = parsed;
    } catch { /* lege body → ongeldig */ }

    const action = str(b.action);
    const tenantId = str(b.tenant);
    const rawEmail = str(b.email);
    const sig = str(b.s);
    if (!tenantId || !UUID_RE.test(tenantId) || !rawEmail || !(await verifyMarketingLink(tenantId, rawEmail, sig))) {
      // Geen lees- of schrijfactie zonder geldige handtekening.
      return jsonResponse({ valid: false }, 400, cors);
    }
    const email = rawEmail.trim().toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "get") {
      // Enkel lezen. Bestaat er geen rij, dan geven we de standaardwaarden terug
      // zonder iets aan te maken; een rij ontstaat pas bij opslaan.
      const [{ data: prefs }, shop] = await Promise.all([
        supabase
          .from("email_preferences")
          .select("newsletter, promotions, product_updates, frequency")
          .eq("tenant_id", tenantId)
          .ilike("email", ilikeExact(email))
          .maybeSingle(),
        getShopInfo(supabase, tenantId),
      ]);
      return jsonResponse({
        valid: true,
        ...shop,
        preferences: {
          newsletter: prefs?.newsletter ?? true,
          promotions: prefs?.promotions ?? true,
          product_updates: prefs?.product_updates ?? true,
          frequency: prefs?.frequency ?? "normal",
        },
      }, 200, cors);
    }

    if (action === "save") {
      const newsletter = b.newsletter === true;
      const promotions = b.promotions === true;
      const productUpdates = b.product_updates === true;
      const rawFrequency = str(b.frequency) || "normal";
      const frequency = ALLOWED_FREQUENCIES.has(rawFrequency) ? rawFrequency : "normal";

      const { error: prefError } = await supabase
        .from("email_preferences")
        .upsert({
          tenant_id: tenantId,
          email,
          newsletter,
          promotions,
          product_updates: productUpdates,
          frequency,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,email" });
      if (prefError) {
        console.error("[email-preferences] upsert mislukt", prefError);
        throw prefError;
      }

      // Alles uit = uitgeschreven voor marketing. Het omgekeerde (iets aan) zet
      // email_subscribed bewust NIET terug op true: dat is geen geldige
      // toestemming zonder double opt-in.
      if (!newsletter && !promotions && !productUpdates) {
        const { error: custError } = await supabase
          .from("customers")
          .update({ email_subscribed: false })
          .eq("tenant_id", tenantId)
          .ilike("email", ilikeExact(email));
        if (custError) console.error("[email-preferences] customers update mislukt", custError);

        // MAIL-2a review-fix: ook op de uitschrijflijst, zodat die volledig is (automations,
        // doelgroepen). Een bestaande rij (en haar reden, bv. bounce) blijft ongemoeid.
        const { error: unsubError } = await supabase
          .from("email_unsubscribes")
          .upsert({
            tenant_id: tenantId,
            email,
            reason: "preferences",
            unsubscribed_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,email", ignoreDuplicates: true });
        if (unsubError) console.error("[email-preferences] email_unsubscribes upsert mislukt", unsubError);
      }

      return jsonResponse({ ok: true }, 200, cors);
    }

    return jsonResponse({ ok: false, error: "unknown_action" }, 400, cors);
  } catch (error) {
    console.error("[email-preferences] fout:", error);
    return jsonResponse({ ok: false, error: "server" }, 500, cors);
  }
});
