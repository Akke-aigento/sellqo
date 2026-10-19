import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  verifyMarketingLink,
  buildUnsubscribeUrl,
  escapeHtml,
} from "../_shared/marketingToken.ts";
import { tenantSender } from "../_shared/emailSenders.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { getShopInfo, isJsonRequest, jsonResponse, pickParams, redirectToApp } from "../_shared/mailPages.ts";

/**
 * MAIL-1a — uitschrijven. MAIL-1c — pagina verhuisd naar sellqo.app/mail/afmelden.
 *
 * - Elke statuswijziging vraagt een geldige handtekening (`s`) over (tenant, e-mail).
 * - Browser-GET (link in een mail): 302 naar /mail/afmelden met dezelfde parameters.
 *   Deze functie rendert geen HTML meer: Supabase serveert die als text/plain.
 * - POST met `Content-Type: application/json`: API voor die pagina, acties
 *   `info` (toont niets geheims, verandert niets), `unsubscribe` en `legacy`.
 * - RFC 8058 one-click: mailclients POSTen naar de List-Unsubscribe-URL (tenant,
 *   email en s in de querystring) met body `List-Unsubscribe=One-Click` → 200 tekst.
 * - Oude links zonder handtekening: enkel een nieuwe, ondertekende link mailen naar
 *   dat adres. Zo kan niemand een ander uitschrijven en blijft afmelden mogelijk (AVG).
 */

// RFC 8058 one-click komt van mailservers (geen browser): die krijgen open CORS
// niet nodig, maar een kale 200. De JSON-API voor de pagina op sellqo.app gebruikt
// getCorsHeaders (enkel onze eigen origins).
const TEXT_HEADERS = { "Content-Type": "text/plain; charset=utf-8" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_REASONS = new Set(["too_many", "not_relevant", "never_signed_up", "other"]);

/** Parameters die een browser-GET meeneemt naar /mail/afmelden. */
const FORWARD_KEYS = ["tenant", "email", "s", "campaign", "lang"] as const;

/** ilike zonder wildcards: `_` en `%` in een adres mogen niet op andere adressen matchen. */
const ilikeExact = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

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


/** Schrijft uit. Ongewijzigd gedrag t.o.v. de POST van MAIL-1a. */
// deno-lint-ignore no-explicit-any
async function performUnsubscribe(supabase: any, tenantId: string, email: string, campaignId: string | null, reason: string | null) {
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
      campaign_id: campaignId,
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
      unsubscribe_reason: reason,
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
}

const str = (v: unknown): string | null => (typeof v === "string" && v.length <= 512 ? v : null);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") return handleCorsOptions(req);

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  // Browser-GET vanuit een mail: naar de pagina op sellqo.app. Verandert niets.
  if (req.method === "GET") {
    return redirectToApp("/mail/afmelden", pickParams(url, FORWARD_KEYS));
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── JSON-API voor /mail/afmelden ─────────────────────────────────────────
  if (isJsonRequest(req)) {
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
      const tenantValid = !!tenantId && UUID_RE.test(tenantId);
      if (!tenantValid || !rawEmail) return jsonResponse({ valid: false, legacy: false }, 400, cors);
      const email = rawEmail.trim().toLowerCase();

      if (action === "legacy") {
        // Enkel voor oude links zonder handtekening; altijd hetzelfde antwoord,
        // zodat het niet verraadt of het adres bij de winkel bekend is.
        if (!sig && EMAIL_RE.test(email)) await sendFreshUnsubscribeLink(supabase, tenantId, email);
        return jsonResponse({ ok: true }, 200, cors);
      }

      const valid = await verifyMarketingLink(tenantId, email, sig);
      const legacy = !valid && !sig && EMAIL_RE.test(email);

      if (action === "info") {
        // Shopinfo enkel bij een geldige of legacy-link: anders kan iedereen met een
        // tenant-id de naam opvragen (beperkt, maar onnodig).
        const shop = valid || legacy ? await getShopInfo(supabase, tenantId) : { shop_name: "", logo_url: null, shop_url: null };
        return jsonResponse({ valid, legacy, ...shop }, 200, cors);
      }

      if (action === "unsubscribe") {
        if (!valid) return jsonResponse({ ok: false, error: "invalid" }, 400, cors);
        const campaign = str(b.campaign);
        const reason = str(b.reason);
        await performUnsubscribe(
          supabase,
          tenantId,
          email,
          campaign && UUID_RE.test(campaign) ? campaign : null,
          reason && ALLOWED_REASONS.has(reason) ? reason : null,
        );
        return jsonResponse({ ok: true }, 200, cors);
      }

      return jsonResponse({ ok: false, error: "unknown_action" }, 400, cors);
    } catch (error) {
      console.error("[unsubscribe] JSON-fout:", error);
      return jsonResponse({ ok: false, error: "server" }, 500, cors);
    }
  }

  // ── RFC 8058 one-click (en oude formulier-POSTs) ─────────────────────────
  try {
    let body = new URLSearchParams();
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
    const oneClick = (body.get("List-Unsubscribe") || "").trim() === "One-Click";
    const pick = (k: string) => url.searchParams.get(k) || body.get(k) || null;
    const tenantId = pick("tenant") || body.get("tenant_id");
    const rawEmail = pick("email");
    const sig = pick("s");
    const campaign = pick("campaign");
    const reason = body.get("reason");

    const valid = !!tenantId && UUID_RE.test(tenantId) && await verifyMarketingLink(tenantId, rawEmail, sig);
    if (!valid) {
      // Geen statuswijziging zonder geldige handtekening.
      return new Response("Invalid link", { status: 400, headers: TEXT_HEADERS });
    }

    await performUnsubscribe(
      supabase,
      tenantId as string,
      (rawEmail as string).trim().toLowerCase(),
      campaign && UUID_RE.test(campaign) ? campaign : null,
      reason && ALLOWED_REASONS.has(reason) ? reason : null,
    );

    if (oneClick) {
      // RFC 8058: de mailclient verwacht enkel een 2xx.
      return new Response("OK", { status: 200, headers: TEXT_HEADERS });
    }
    // Formulier-POST uit een nog openstaande oude pagina: toon de bevestiging in de app.
    return redirectToApp("/mail/afmelden", { tenant: tenantId, email: rawEmail, s: sig, done: "1" });
  } catch (error) {
    console.error("[unsubscribe] fout:", error);
    return new Response("Error", { status: 500, headers: TEXT_HEADERS });
  }
});
