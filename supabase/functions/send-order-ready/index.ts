// FOOD-3 — mail de klant als de keuken de bestelling klaarzet (afhalen) of meegeeft
// (levering). Aangeroepen vanuit het keukenscherm met de JWT van de kok/kassier; de
// functie controleert zelf of die bij de winkel hoort. Idempotent via
// kitchen_tickets.notified_at: één mail per bestelling.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { tenantSender } from "../_shared/emailSenders.ts";
import { getTenantBrand, renderTenantEmail, resolveEmailLocale, type TenantLocale } from "../_shared/tenantEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Kind = "ready" | "on_the_way";
const TEXT: Record<TenantLocale, Record<Kind, { subject: string; heading: string; intro: string }> & { pay: string; order: string }> = {
  nl: {
    ready: { subject: "Je bestelling {n} is klaar", heading: "Je bestelling is klaar!", intro: "Dag {name}, je bestelling ligt klaar. Je mag ze komen afhalen." },
    on_the_way: { subject: "Je bestelling {n} is onderweg", heading: "Je bestelling is onderweg!", intro: "Dag {name}, je bestelling is net vertrokken en komt eraan." },
    pay: "Nog te betalen: {amount} (contant of met je bankkaart).", order: "Bestelling",
  },
  en: {
    ready: { subject: "Your order {n} is ready", heading: "Your order is ready!", intro: "Hi {name}, your order is ready. You can come and pick it up." },
    on_the_way: { subject: "Your order {n} is on its way", heading: "Your order is on its way!", intro: "Hi {name}, your order just left and is on its way to you." },
    pay: "Still to pay: {amount} (cash or card).", order: "Order",
  },
  fr: {
    ready: { subject: "Votre commande {n} est prête", heading: "Votre commande est prête !", intro: "Bonjour {name}, votre commande est prête. Vous pouvez venir la chercher." },
    on_the_way: { subject: "Votre commande {n} est en route", heading: "Votre commande est en route !", intro: "Bonjour {name}, votre commande vient de partir et arrive bientôt." },
    pay: "Reste à payer : {amount} (en espèces ou par carte).", order: "Commande",
  },
  de: {
    ready: { subject: "Ihre Bestellung {n} ist fertig", heading: "Ihre Bestellung ist fertig!", intro: "Hallo {name}, Ihre Bestellung ist fertig. Sie können sie abholen." },
    on_the_way: { subject: "Ihre Bestellung {n} ist unterwegs", heading: "Ihre Bestellung ist unterwegs!", intro: "Hallo {name}, Ihre Bestellung ist gerade losgefahren." },
    pay: "Noch zu zahlen: {amount} (bar oder mit Karte).", order: "Bestellung",
  },
};
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: "FOOD-3" });

  try {
    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id || typeof order_id !== "string") return json({ error: "order_id is required" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: order } = await supabase.from("orders")
      .select("id, tenant_id, order_number, customer_email, customer_name, total, currency, locale, shipping_address, payment_method, payment_status, service_type")
      .eq("id", order_id).maybeSingle();
    if (!order) return json({ error: "Order not found" }, 404);

    // Alleen iemand van deze winkel mag de klant laten mailen.
    await authenticateRequest(req, order.tenant_id);

    const { data: ticket } = await supabase.from("kitchen_tickets").select("id, status, notified_at").eq("order_id", order.id).maybeSingle();
    if (!ticket) return json({ skipped: true, reason: "no kitchen ticket" });
    if (ticket.notified_at) return json({ skipped: true, reason: "already notified" });

    const kind: Kind | null = order.service_type === "pickup" && ticket.status === "ready" ? "ready"
      : order.service_type === "local_delivery" && ticket.status === "done" ? "on_the_way" : null;
    if (!kind) return json({ skipped: true, reason: "status does not trigger a message" });
    if (!order.customer_email) return json({ skipped: true, reason: "no recipient email" });

    const { data: fs } = await supabase.from("fulfillment_settings").select("notify_ready").eq("tenant_id", order.tenant_id).maybeSingle();
    if (fs && fs.notify_ready === false) return json({ skipped: true, reason: "disabled by tenant" });

    // Eerst claimen (idempotent bij dubbelklik of twee tablets), dan pas mailen.
    const { data: claimed } = await supabase.from("kitchen_tickets")
      .update({ notified_at: new Date().toISOString() }).eq("id", ticket.id).is("notified_at", null).select("id");
    if (!claimed || claimed.length === 0) return json({ skipped: true, reason: "already notified" });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not set");

    const brand = await getTenantBrand(supabase, order.tenant_id);
    const locale: TenantLocale = await resolveEmailLocale(supabase, {
      explicit: order.locale, tenantId: order.tenant_id, countryCode: order.shipping_address?.country, tenantDefault: brand.defaultLocale,
    });
    const tx = TEXT[locale] || TEXT.nl;
    const n = order.order_number || order.id.slice(0, 8);
    const name = esc(String(order.customer_name || "").split(" ")[0] || "");
    const amount = new Intl.NumberFormat("nl-BE", { style: "currency", currency: order.currency || "EUR" }).format(Number(order.total) || 0);
    const owes = order.payment_method === "pay_on_pickup" && order.payment_status !== "paid";

    const content = `
      <p style="margin:16px 0 0;font-size:15px;"><strong>${tx.order}:</strong> ${esc(n)}</p>
      ${owes ? `<p style="margin:8px 0 0;font-size:15px;">${esc(fill(tx.pay, { amount }))}</p>` : ""}`;
    const { html, text } = renderTenantEmail({
      tenantBrand: brand, locale,
      preheader: fill(tx[kind].heading, {}),
      heading: tx[kind].heading,
      intro: `<p>${fill(tx[kind].intro, { name }).replace(/ ,/g, ",")}</p>`,
      content,
    });

    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const sender = tenantSender(brand.senderSource);
    const { data: sent, error } = await new Resend(resendApiKey).emails.send({
      from: sender.from, to: [order.customer_email], subject: fill(tx[kind].subject, { n }), html, text, reply_to: sender.replyTo,
    });
    if (error) {
      // Mail mislukt: claim terugdraaien zodat een volgende klik het opnieuw probeert.
      await supabase.from("kitchen_tickets").update({ notified_at: null }).eq("id", ticket.id);
      throw new Error(`Email verzenden mislukt: ${error.message}`);
    }
    return json({ success: true, kind, email_id: sent?.id });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error("[SEND-ORDER-READY]", error instanceof Error ? error.message : error);
    return json({ error: error instanceof Error ? error.message : "unknown" }, 500);
  }
});
