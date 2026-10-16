// SHIP-MAIL-1 — verzendmail aan de klant, in de taal van de klant (nl/en/fr/de) en in de
// huisstijl van de winkel. Eén plek voor alle routes:
//   - handmatig: tracking toevoegen op de orderpagina (useOrderShipping, JWT van de winkel);
//   - automatisch: printful-webhook en tracking-webhook (service role).
// Vroeger bouwde de admin een Nederlandstalige mail in de browser, en stuurden de webhooks
// een payload die send-customer-message niet kende (de automatische mail ging dus nooit).
// Idempotent per tracknummer: dezelfde zending mailt de klant maar één keer.
// Automatische route slaat marketplace-orders (bol.com e.a.) over; die verwittigt het
// platform zelf. Handmatig beslist de winkel (vinkje "klant verwittigen").
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { tenantSender } from "../_shared/emailSenders.ts";
import { getTenantBrand, renderTenantEmail, resolveEmailLocale, type TenantLocale } from "../_shared/tenantEmail.ts";

const VERSION = "SHIP-MAIL-1";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface Strings { subject: string; heading: string; intro: string; order: string; carrier: string; number: string; track: string; outro: string }
const TEXT: Record<TenantLocale, Strings> = {
  nl: {
    subject: "Je bestelling {n} is onderweg", heading: "Je bestelling is onderweg!",
    intro: "Dag {name}, goed nieuws: je bestelling is verzonden.",
    order: "Bestelling", carrier: "Vervoerder", number: "Tracknummer", track: "Volg je pakket",
    outro: "Heb je een vraag over je zending? Antwoord gewoon op deze mail.",
  },
  en: {
    subject: "Your order {n} is on its way", heading: "Your order is on its way!",
    intro: "Hi {name}, good news: your order has been shipped.",
    order: "Order", carrier: "Carrier", number: "Tracking number", track: "Track your parcel",
    outro: "Questions about your delivery? Just reply to this email.",
  },
  fr: {
    subject: "Votre commande {n} est en route", heading: "Votre commande est en route !",
    intro: "Bonjour {name}, bonne nouvelle : votre commande a été expédiée.",
    order: "Commande", carrier: "Transporteur", number: "Numéro de suivi", track: "Suivre votre colis",
    outro: "Une question sur votre livraison ? Répondez simplement à cet e-mail.",
  },
  de: {
    subject: "Ihre Bestellung {n} ist unterwegs", heading: "Ihre Bestellung ist unterwegs!",
    intro: "Hallo {name}, gute Nachricht: Ihre Bestellung wurde versandt.",
    order: "Bestellung", carrier: "Versanddienst", number: "Sendungsnummer", track: "Paket verfolgen",
    outro: "Fragen zu Ihrer Lieferung? Antworten Sie einfach auf diese E-Mail.",
  },
};
const CARRIER_NAMES: Record<string, string> = {
  bpost: "bpost", postnl: "PostNL", dhl: "DHL", dpd: "DPD", gls: "GLS", ups: "UPS", fedex: "FedEx",
  tnt: "TNT", colissimo: "Colissimo", royal_mail: "Royal Mail", usps: "USPS", sendcloud: "Sendcloud",
};
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: VERSION });

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = str(body.order_id);
    const source: "manual" | "auto" = body.source === "manual" ? "manual" : "auto";
    if (!orderId) return json({ error: "order_id is required" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: order } = await supabase.from("orders")
      .select("id, tenant_id, order_number, customer_id, customer_email, customer_name, locale, shipping_address, carrier, tracking_number, tracking_url, marketplace_source")
      .eq("id", orderId).maybeSingle();
    if (!order) return json({ error: "Order not found" }, 404);

    // Alleen de winkel zelf (of de service role van een webhook) mag dit versturen.
    const auth = await authenticateRequest(req, order.tenant_id);
    requireRole(auth, order.tenant_id, ["tenant_admin", "staff", "accountant"]);

    if (source === "auto" && order.marketplace_source) return json({ skipped: true, reason: "marketplace order" });
    if (!order.customer_email) return json({ skipped: true, reason: "no recipient email" });

    const trackingNumber = str(body.tracking_number) ?? str(order.tracking_number);
    if (!trackingNumber) return json({ skipped: true, reason: "no tracking number" });
    const trackingUrl = str(body.tracking_url) ?? str(order.tracking_url);
    const carrierId = str(order.carrier) ?? "";
    const carrierName = str(body.carrier_name) ?? CARRIER_NAMES[carrierId.toLowerCase()] ?? carrierId;

    // Idempotent: is deze zending al gemaild, dan niet nog eens.
    const { data: earlier } = await supabase.from("customer_messages").select("id")
      .eq("order_id", order.id).eq("direction", "outbound")
      .eq("context_data->>tracking_number", trackingNumber).limit(1);
    if (earlier && earlier.length > 0) return json({ skipped: true, reason: "already notified" });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not set");

    const brand = await getTenantBrand(supabase, order.tenant_id);
    const locale: TenantLocale = await resolveEmailLocale(supabase, {
      explicit: order.locale, tenantId: order.tenant_id, countryCode: order.shipping_address?.country, tenantDefault: brand.defaultLocale,
    });
    const tx = TEXT[locale] || TEXT.nl;
    const n = order.order_number || order.id.slice(0, 8);
    const name = esc(String(order.customer_name || "").split(" ")[0] || "");
    const row = (label: string, value: string) =>
      `<tr><td style="padding:4px 16px 4px 0;font-size:14px;color:${brand.mutedColor};white-space:nowrap;">${esc(label)}</td>` +
      `<td style="padding:4px 0;font-size:14px;font-weight:600;">${value}</td></tr>`;
    const content = `
      <table role="presentation" style="margin:16px 0;border-collapse:collapse;">
        ${row(tx.order, esc(n))}
        ${carrierName ? row(tx.carrier, esc(carrierName)) : ""}
        ${row(tx.number, trackingUrl ? `<a href="${esc(trackingUrl)}" style="color:${brand.primaryColor};">${esc(trackingNumber)}</a>` : esc(trackingNumber))}
      </table>
      ${trackingUrl ? `<p style="margin:8px 0 0;"><a href="${esc(trackingUrl)}" style="display:inline-block;background:${brand.primaryColor};color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;">${esc(tx.track)}</a></p>` : ""}
      <p style="margin:24px 0 0;font-size:14px;color:${brand.mutedColor};">${esc(tx.outro)}</p>`;
    const subject = fill(tx.subject, { n });
    const { html, text } = renderTenantEmail({
      tenantBrand: brand, locale,
      preheader: tx.heading,
      heading: tx.heading,
      intro: `<p>${fill(tx.intro, { name }).replace(/ ,/g, ",")}</p>`,
      content,
    });

    const sender = tenantSender(brand.senderSource);
    const contextData = { kind: "order_shipped", source, order_number: n, carrier: carrierName, tracking_number: trackingNumber, tracking_url: trackingUrl, locale };
    // Eerst het bericht vastleggen (zichtbaar in de inbox en idempotentiesleutel), dan mailen.
    const { data: message, error: insertError } = await supabase.from("customer_messages").insert({
      tenant_id: order.tenant_id, customer_id: order.customer_id ?? null, order_id: order.id, direction: "outbound",
      subject, body_html: content, body_text: text, from_email: sender.from, to_email: order.customer_email,
      reply_to_email: brand.supportEmail, delivery_status: "sending", context_type: "order", context_data: contextData,
    }).select("id").single();
    if (insertError) throw new Error(`Failed to create message record: ${insertError.message}`);

    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const { data: sent, error } = await new Resend(resendApiKey).emails.send({
      from: sender.from, to: [order.customer_email], reply_to: sender.replyTo, subject, html, text,
    });
    if (error) {
      // Mislukt: het record weg, zodat een nieuwe poging niet als "al gemaild" telt.
      await supabase.from("customer_messages").delete().eq("id", message.id);
      throw new Error(`Email verzenden mislukt: ${error.message}`);
    }
    await supabase.from("customer_messages")
      .update({ resend_id: sent?.id, delivery_status: "sent", sent_at: new Date().toISOString() })
      .eq("id", message.id);
    return json({ success: true, locale, email_id: sent?.id });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error("[SEND-ORDER-SHIPPED]", error instanceof Error ? error.message : error);
    return json({ error: error instanceof Error ? error.message : "unknown" }, 500);
  }
});
