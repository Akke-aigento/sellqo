import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  verifyMarketingLink,
  buildUnsubscribeUrl,
  buildPreferencesUrl,
  escapeHtml,
} from "../_shared/marketingToken.ts";
import { tenantSender } from "../_shared/emailSenders.ts";

/**
 * MAIL-1a — uitschrijven.
 *
 * - Elke statuswijziging vraagt een geldige handtekening (`s`) over (tenant, e-mail).
 *   Zonder geldige handtekening: vriendelijke pagina, niets gewijzigd.
 * - GET toont een bevestigingspagina met een knop; POST schrijft uit.
 * - RFC 8058 one-click: mailclients POSTen naar de List-Unsubscribe-URL (tenant,
 *   email en s staan in de querystring) met body `List-Unsubscribe=One-Click`.
 *   Daarom leest POST eerst de querystring en pas daarna het formulier.
 * - Alles wat in de pagina belandt, gaat door escapeHtml (XSS).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HTML_HEADERS = { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_REASONS = new Set(["too_many", "not_relevant", "never_signed_up", "other"]);

/** ilike zonder wildcards: `_` en `%` in een adres mogen niet op andere adressen matchen. */
const ilikeExact = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

const PAGE_STYLE = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 480px; width: 100%; padding: 40px; text-align: center; }
    h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 16px; }
    p { color: #666; line-height: 1.6; margin-bottom: 24px; }
    .email { font-weight: 600; color: #1a1a1a; word-break: break-all; }
    .icon { font-size: 48px; margin-bottom: 20px; }
    .btn { display: inline-block; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 500; text-decoration: none; cursor: pointer; transition: all 0.2s; border: none; }
    .btn-danger { background: #dc2626; color: white; }
    .btn-danger:hover { background: #b91c1c; }
    .buttons { margin-top: 32px; }
    .reason-select { width: 100%; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; margin-bottom: 16px; }
    form { margin-top: 24px; }
    .footer-link { margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
    .footer-link a { color: #2563eb; text-decoration: none; font-size: 14px; }
    .footer-link a:hover { text-decoration: underline; }
`;

const layout = (title: string, body: string) => `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${title}</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <div class="container">
${body}
  </div>
</body>
</html>
`;

const getUnsubscribePageHtml = (opts: {
  tenantName: string;
  email: string;
  tenantId: string;
  sig: string;
  campaignId: string | null;
  actionUrl: string;
  preferencesUrl: string;
}) => {
  const name = escapeHtml(opts.tenantName);
  return layout(`Uitschrijven - ${name}`, `
    <h1>Uitschrijven van e-mails</h1>
    <p>Wil je geen e-mails meer ontvangen van <strong>${name}</strong>?</p>
    <p>Je schrijft je uit voor: <span class="email">${escapeHtml(opts.email)}</span></p>

    <form action="${escapeHtml(opts.actionUrl)}" method="POST">
      <input type="hidden" name="tenant" value="${escapeHtml(opts.tenantId)}">
      <input type="hidden" name="email" value="${escapeHtml(opts.email)}">
      <input type="hidden" name="s" value="${escapeHtml(opts.sig)}">
      ${opts.campaignId ? `<input type="hidden" name="campaign" value="${escapeHtml(opts.campaignId)}">` : ""}

      <select name="reason" class="reason-select">
        <option value="">Selecteer een reden (optioneel)</option>
        <option value="too_many">Ik ontvang te veel e-mails</option>
        <option value="not_relevant">De inhoud is niet relevant voor mij</option>
        <option value="never_signed_up">Ik heb me nooit ingeschreven</option>
        <option value="other">Andere reden</option>
      </select>

      <div class="buttons">
        <button type="submit" class="btn btn-danger">Uitschrijven</button>
      </div>
    </form>

    <div class="footer-link">
      <a href="${escapeHtml(opts.preferencesUrl)}">Of beheer je e-mailvoorkeuren</a>
    </div>`);
};

const getSuccessPageHtml = (tenantName: string) => {
  const name = escapeHtml(tenantName);
  return layout(`Uitgeschreven - ${name}`, `
    <div class="icon">&#10003;</div>
    <h1>Je bent uitgeschreven</h1>
    <p>Je ontvangt geen marketingmails meer van <strong>${name}</strong>.</p>
    <p style="font-size: 14px;">Mails over je bestellingen (zoals bevestigingen en facturen) blijf je wel ontvangen.</p>
    <div class="footer-link">
      <p style="font-size: 14px; margin-bottom: 0;">Per ongeluk uitgeschreven? Neem contact op met ${name} om je opnieuw in te schrijven.</p>
    </div>`);
};

const getInvalidLinkHtml = () => layout("Ongeldige link", `
    <h1>Ongeldige link</h1>
    <p>Deze link is ongeldig of verlopen. Gebruik de afmeldlink in de meest recente mail, of neem contact op met de winkel.</p>`);

const getErrorHtml = () => layout("Er ging iets mis", `
    <h1>Er ging iets mis</h1>
    <p>Er is een fout opgetreden. Probeer het later opnieuw.</p>`);

// Oude links (vóór MAIL-1a, zonder handtekening) staan nog in verstuurde mails. Wie zo'n link
// gebruikt, kan zich nog altijd uitschrijven: we mailen een ondertekende link naar dat adres.
// Zo kan niemand een ander uitschrijven, en blijft afmelden mogelijk (AVG).
const getLegacyAskHtml = (email: string, tenantId: string, actionUrl: string) => layout("Afmelden", `
    <h1>Afmelden</h1>
    <p>Deze afmeldlink is van een oudere mail. Klik hieronder, dan sturen we een nieuwe afmeldlink naar <strong>${escapeHtml(email)}</strong>.</p>
    <form method="POST" action="${escapeHtml(actionUrl)}">
      <input type="hidden" name="tenant" value="${escapeHtml(tenantId)}">
      <input type="hidden" name="email" value="${escapeHtml(email)}">
      <input type="hidden" name="legacy" value="1">
      <button type="submit" class="btn btn-danger">Stuur mij een afmeldlink</button>
    </form>`);

const getLegacySentHtml = () => layout("Kijk in je mailbox", `
    <h1>Kijk in je mailbox</h1>
    <p>Als dit adres bij ons bekend is, ontvang je binnen enkele minuten een mail met een link om je af te melden.</p>`);

/** Leest tenant/email/s/campaign/reason: eerst uit de querystring, dan uit de body. */
async function readParams(req: Request, url: URL) {
  let body = new URLSearchParams();
  let oneClick = false;
  if (req.method === "POST") {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    try {
      if (ct.includes("multipart/form-data")) {
        const fd = await req.formData();
        for (const [k, v] of fd.entries()) if (typeof v === "string") body.append(k, v);
      } else {
        // form-urlencoded, of een client zonder content-type
        body = new URLSearchParams(await req.text());
      }
    } catch (e) {
      console.warn("[unsubscribe] body niet leesbaar", e);
    }
    oneClick = (body.get("List-Unsubscribe") || "").trim() === "One-Click";
  }
  const pick = (k: string) => url.searchParams.get(k) || body.get(k) || null;
  const campaign = pick("campaign");
  const reason = body.get("reason");
  return {
    tenantId: pick("tenant") || body.get("tenant_id"),
    email: pick("email"),
    sig: pick("s"),
    campaignId: campaign && UUID_RE.test(campaign) ? campaign : null,
    reason: reason && ALLOWED_REASONS.has(reason) ? reason : null,
    legacy: body.get("legacy") === "1",
    oneClick,
  };
}

/** Stuurt een ondertekende afmeldlink, enkel naar een adres dat de winkel kent. */
// deno-lint-ignore no-explicit-any
async function sendFreshUnsubscribeLink(supabase: any, tenantId: string, email: string) {
  try {
    const escaped = ilikeExact(email);
    const [{ data: cust }, { data: sub }] = await Promise.all([
      supabase.from("customers").select("id").eq("tenant_id", tenantId).ilike("email", escaped).limit(1),
      supabase.from("newsletter_subscribers").select("id").eq("tenant_id", tenantId).ilike("email", escaped).limit(1),
    ]);
    if (!cust?.length && !sub?.length) return;
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, slug, inbound_email_prefix, support_email")
      .eq("id", tenantId)
      .maybeSingle();
    if (!tenant) return;
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return;
    const link = await buildUnsubscribeUrl(tenantId, email);
    const sender = tenantSender(tenant);
    const name = escapeHtml(tenant.name || "");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: sender.from,
        reply_to: sender.replyTo,
        to: [email],
        subject: `Afmelden voor de nieuwsbrief van ${tenant.name || "de webshop"}`,
        html: `<p>Je vroeg om je af te melden voor de nieuwsbrief van ${name}.</p><p><a href="${escapeHtml(link)}">Klik hier om je af te melden</a></p><p>Vroeg je dit niet? Dan mag je deze mail negeren.</p>`,
        text: `Je vroeg om je af te melden voor de nieuwsbrief van ${tenant.name || "de webshop"}.\n\nAfmelden: ${link}\n\nVroeg je dit niet? Dan mag je deze mail negeren.`,
      }),
    });
    if (!res.ok) console.error("[unsubscribe] nieuwe afmeldlink versturen mislukt", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("[unsubscribe] nieuwe afmeldlink fout", e);
  }
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
    const valid = tenantValid && await verifyMarketingLink(p.tenantId, p.email, p.sig);

    // Oude link zonder handtekening: enkel een nieuwe, ondertekende link mailen.
    const legacyEmail = (p.email || "").trim().toLowerCase();
    if (!valid && tenantValid && !p.sig && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(legacyEmail)) {
      const selfUrl = `${supabaseUrl}/functions/v1/unsubscribe`;
      if (req.method === "GET") {
        return new Response(getLegacyAskHtml(legacyEmail, p.tenantId as string, selfUrl), { headers: HTML_HEADERS });
      }
      if (p.legacy) {
        await sendFreshUnsubscribeLink(supabase, p.tenantId as string, legacyEmail);
        // Altijd hetzelfde antwoord: verraadt niet of het adres bekend is.
        return new Response(getLegacySentHtml(), { headers: HTML_HEADERS });
      }
    }

    if (!valid) {
      // Geen statuswijziging zonder geldige handtekening.
      return new Response(getInvalidLinkHtml(), { status: 400, headers: HTML_HEADERS });
    }

    const tenantId = p.tenantId as string;
    const email = (p.email as string).trim().toLowerCase();
    const sig = p.sig as string;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .maybeSingle();
    const tenantName = tenant?.name || "onze webshop";

    // GET — bevestigingspagina, verandert niets.
    if (req.method === "GET") {
      let actionUrl = await buildUnsubscribeUrl(tenantId, email);
      if (p.campaignId) actionUrl += `&campaign=${encodeURIComponent(p.campaignId)}`;
      const preferencesUrl = await buildPreferencesUrl(tenantId, email);
      return new Response(
        getUnsubscribePageHtml({ tenantName, email, tenantId, sig, campaignId: p.campaignId, actionUrl, preferencesUrl }),
        { headers: HTML_HEADERS },
      );
    }

    // POST — uitschrijven (formulier of RFC 8058 one-click).
    const now = new Date().toISOString();

    // Bestaat de uitschrijving al? Dan blijft de oorspronkelijke datum staan.
    const { data: existing } = await supabase
      .from("email_unsubscribes")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .maybeSingle();

    if (!existing) {
      const { error: unsubError } = await supabase.from("email_unsubscribes").upsert({
        tenant_id: tenantId,
        email,
        reason: "unsubscribe",
        campaign_id: p.campaignId,
        unsubscribed_at: now,
      }, { onConflict: "tenant_id,email" });
      if (unsubError) console.error("[unsubscribe] email_unsubscribes upsert mislukt", unsubError);
    }

    const { error: custError } = await supabase
      .from("customers")
      .update({ email_subscribed: false })
      .eq("tenant_id", tenantId)
      .ilike("email", ilikeExact(email));
    if (custError) console.error("[unsubscribe] customers update mislukt", custError);

    const { error: nlError } = await supabase
      .from("newsletter_subscribers")
      .update({
        status: "unsubscribed",
        unsubscribed_at: now,
        unsubscribe_reason: p.reason,
      })
      .eq("tenant_id", tenantId)
      .ilike("email", ilikeExact(email));
    if (nlError) console.error("[unsubscribe] newsletter_subscribers update mislukt", nlError);

    const { error: prefError } = await supabase
      .from("email_preferences")
      .upsert({
        tenant_id: tenantId,
        email,
        newsletter: false,
        promotions: false,
        product_updates: false,
        updated_at: now,
      }, { onConflict: "tenant_id,email" });
    if (prefError) console.error("[unsubscribe] email_preferences upsert mislukt", prefError);

    if (p.oneClick) {
      // RFC 8058: de mailclient verwacht enkel een 2xx.
      return new Response("OK", { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } });
    }

    return new Response(getSuccessPageHtml(tenantName), { headers: HTML_HEADERS });
  } catch (error) {
    console.error("[unsubscribe] fout:", error);
    return new Response(getErrorHtml(), { status: 500, headers: HTML_HEADERS });
  }
});
