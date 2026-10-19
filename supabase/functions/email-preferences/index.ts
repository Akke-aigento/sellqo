import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  verifyMarketingLink,
  buildPreferencesUrl,
  buildUnsubscribeUrl,
  escapeHtml,
} from "../_shared/marketingToken.ts";

/**
 * MAIL-1a — mailvoorkeuren.
 *
 * - GET en POST vragen een geldige handtekening (`s`) over (tenant, e-mail).
 *   Zonder geldige handtekening: vriendelijke pagina, niets gelezen of aangemaakt.
 * - Opslaan zet customers.email_subscribed NOOIT op true: opnieuw inschrijven via
 *   deze pagina is geen geldige toestemming (geen double opt-in). Alles uitzetten
 *   zet hem wel op false.
 * - Alles wat in de pagina belandt, gaat door escapeHtml (XSS).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HTML_HEADERS = { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_FREQUENCIES = new Set(["normal", "weekly", "minimal"]);

/** ilike zonder wildcards: `_` en `%` in een adres mogen niet op andere adressen matchen. */
const ilikeExact = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

const simplePage = (title: string, message: string) => `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; margin: 0; }
    .container { background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 480px; width: 100%; padding: 40px; text-align: center; }
    h1 { color: #1a1a1a; font-size: 24px; margin: 0 0 16px; }
    p { color: #666; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>
`;

const invalidLinkResponse = () =>
  new Response(
    simplePage(
      "Ongeldige link",
      "Deze link is ongeldig of verlopen. Gebruik de afmeldlink in de meest recente mail, of neem contact op met de winkel.",
    ),
    { status: 400, headers: HTML_HEADERS },
  );

const getPreferencesPageHtml = (opts: {
  tenantName: string;
  email: string;
  preferences: { newsletter: boolean; promotions: boolean; product_updates: boolean; frequency: string };
  tenantId: string;
  sig: string;
  actionUrl: string;
  unsubscribeUrl: string;
  saved: boolean;
}) => {
  const name = escapeHtml(opts.tenantName);
  const prefs = opts.preferences;
  return `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>E-mailvoorkeuren - ${name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; padding: 40px 20px; }
    .container { background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 560px; margin: 0 auto; padding: 40px; }
    h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #666; margin-bottom: 32px; }
    .email-display { background: #f8fafc; padding: 12px 16px; border-radius: 8px; margin-bottom: 32px; font-size: 14px; color: #4b5563; word-break: break-all; }
    .email-display strong { color: #1a1a1a; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 16px; }
    .option { display: flex; align-items: flex-start; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s; }
    .option:hover { border-color: #a5b4fc; background: #f5f3ff; }
    .option.active { border-color: #7c3aed; background: #f5f3ff; }
    .option input { margin-top: 4px; }
    .option-content { margin-left: 12px; flex: 1; }
    .option-title { font-weight: 500; color: #1a1a1a; margin-bottom: 4px; }
    .option-desc { font-size: 14px; color: #6b7280; }
    .note { font-size: 13px; color: #6b7280; margin-bottom: 24px; line-height: 1.5; }
    .frequency-select { width: 100%; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
    .btn { display: inline-block; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; }
    .btn-primary { background: #7c3aed; color: white; width: 100%; }
    .btn-primary:hover { background: #6d28d9; }
    .unsubscribe-all { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; }
    .unsubscribe-all a { color: #dc2626; font-size: 14px; text-decoration: none; }
    .unsubscribe-all a:hover { text-decoration: underline; }
    .success-message { background: #d1fae5; color: #065f46; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>E-mailvoorkeuren</h1>
    <p class="subtitle">Beheer welke e-mails je ontvangt van ${name}</p>

    <div class="email-display">
      E-mail: <strong>${escapeHtml(opts.email)}</strong>
    </div>

    ${opts.saved ? `<div class="success-message">&#10003; Je voorkeuren zijn opgeslagen.</div>` : ""}

    <form action="${escapeHtml(opts.actionUrl)}" method="POST" id="preferencesForm">
      <input type="hidden" name="tenant" value="${escapeHtml(opts.tenantId)}">
      <input type="hidden" name="email" value="${escapeHtml(opts.email)}">
      <input type="hidden" name="s" value="${escapeHtml(opts.sig)}">

      <div class="section">
        <div class="section-title">Soorten e-mails</div>

        <label class="option ${prefs.newsletter ? "active" : ""}">
          <input type="checkbox" name="newsletter" ${prefs.newsletter ? "checked" : ""}>
          <div class="option-content">
            <div class="option-title">Nieuwsbrief</div>
            <div class="option-desc">Algemene updates, nieuws en inhoud</div>
          </div>
        </label>

        <label class="option ${prefs.promotions ? "active" : ""}">
          <input type="checkbox" name="promotions" ${prefs.promotions ? "checked" : ""}>
          <div class="option-content">
            <div class="option-title">Aanbiedingen en kortingen</div>
            <div class="option-desc">Deals en promoties</div>
          </div>
        </label>

        <label class="option ${prefs.product_updates ? "active" : ""}">
          <input type="checkbox" name="product_updates" ${prefs.product_updates ? "checked" : ""}>
          <div class="option-content">
            <div class="option-title">Nieuwe producten</div>
            <div class="option-desc">Updates over nieuwe producten en collecties</div>
          </div>
        </label>
      </div>

      <p class="note">Ben je uitgeschreven en wil je opnieuw mails ontvangen? Schrijf je dan opnieuw in via de website van de winkel.</p>

      <div class="section">
        <div class="section-title">Frequentie</div>
        <select name="frequency" class="frequency-select">
          <option value="normal" ${prefs.frequency === "normal" ? "selected" : ""}>Normaal - zoals gepland</option>
          <option value="weekly" ${prefs.frequency === "weekly" ? "selected" : ""}>Wekelijks - max 1x per week</option>
          <option value="minimal" ${prefs.frequency === "minimal" ? "selected" : ""}>Minimaal - alleen belangrijke updates</option>
        </select>
      </div>

      <button type="submit" class="btn btn-primary">Voorkeuren opslaan</button>

      <div class="unsubscribe-all">
        <a href="${escapeHtml(opts.unsubscribeUrl)}">Uitschrijven van alle e-mails</a>
      </div>
    </form>
  </div>

  <script>
    document.querySelectorAll('.option').forEach(option => {
      const checkbox = option.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', () => {
        option.classList.toggle('active', checkbox.checked);
      });
    });
  </script>
</body>
</html>
`;
};

/** Leest tenant/email/s: eerst uit de querystring, dan uit het formulier. */
async function readParams(req: Request, url: URL) {
  let body = new URLSearchParams();
  if (req.method === "POST") {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    try {
      if (ct.includes("multipart/form-data")) {
        const fd = await req.formData();
        for (const [k, v] of fd.entries()) if (typeof v === "string") body.append(k, v);
      } else {
        body = new URLSearchParams(await req.text());
      }
    } catch (e) {
      console.warn("[email-preferences] body niet leesbaar", e);
    }
  }
  const pick = (k: string) => url.searchParams.get(k) || body.get(k) || null;
  return {
    tenantId: pick("tenant") || body.get("tenant_id"),
    email: pick("email"),
    sig: pick("s"),
    body,
  };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const p = await readParams(req, url);
    const tenantValid = !!p.tenantId && UUID_RE.test(p.tenantId);
    if (!tenantValid || !(await verifyMarketingLink(p.tenantId, p.email, p.sig))) {
      // Geen lees- of schrijfactie zonder geldige handtekening.
      return invalidLinkResponse();
    }

    const tenantId = p.tenantId as string;
    const email = (p.email as string).trim().toLowerCase();
    const sig = p.sig as string;

    // GET - voorkeurenpagina tonen
    if (req.method === "GET") {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantId)
        .maybeSingle();
      const tenantName = tenant?.name || "onze webshop";

      // Enkel lezen. Bestaat er geen rij, dan tonen we de standaardwaarden
      // zonder iets aan te maken; een rij ontstaat pas bij opslaan.
      const { data: prefs } = await supabase
        .from("email_preferences")
        .select("newsletter, promotions, product_updates, frequency")
        .eq("tenant_id", tenantId)
        .ilike("email", ilikeExact(email))
        .maybeSingle();

      const preferences = {
        newsletter: prefs?.newsletter ?? true,
        promotions: prefs?.promotions ?? true,
        product_updates: prefs?.product_updates ?? true,
        frequency: prefs?.frequency ?? "normal",
      };

      const [actionUrl, unsubscribeUrl] = await Promise.all([
        buildPreferencesUrl(tenantId, email),
        buildUnsubscribeUrl(tenantId, email),
      ]);

      return new Response(
        getPreferencesPageHtml({
          tenantName,
          email,
          preferences,
          tenantId,
          sig,
          actionUrl,
          unsubscribeUrl,
          saved: url.searchParams.get("saved") === "true",
        }),
        { headers: HTML_HEADERS },
      );
    }

    // POST - voorkeuren opslaan
    const newsletter = p.body.get("newsletter") === "on";
    const promotions = p.body.get("promotions") === "on";
    const productUpdates = p.body.get("product_updates") === "on";
    const rawFrequency = p.body.get("frequency") || "normal";
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
    }

    // Terug naar de (ondertekende, absolute) voorkeurenpagina met bevestiging.
    const redirectUrl = `${await buildPreferencesUrl(tenantId, email)}&saved=true`;
    return new Response(null, {
      status: 303,
      headers: { ...corsHeaders, "Location": redirectUrl },
    });
  } catch (error) {
    console.error("[email-preferences] fout:", error);
    return new Response(
      simplePage("Er ging iets mis", "Er is een fout opgetreden. Probeer het later opnieuw."),
      { status: 500, headers: HTML_HEADERS },
    );
  }
});
