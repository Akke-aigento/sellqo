// PRINT-2 — betaalbewijs per mail.
//
//   - Online betaald via de QR aan tafel (databank, X-Internal-Secret, enkel als de zaak
//     "mail_online" aanzette): { source: "online", payment_id }. Het adres komt uit de
//     Stripe-checkout van de gast. Eén mail per betaling (unieke index).
//   - Knop "Mail bon" op het afrekenscherm van de kassa (sessie van een teamlid, "mail_button" aan):
//     { source: "kassa", payment_id, email }. Hoogstens 3 per betaling en 300 per dag per zaak.
// Nooit bij een geregistreerde kassa (FDM): daar is het digitale kasticket iets anders.
// Het adres wordt niet bewaard, enkel een SHA-256 (horeca_receipt_mails).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { authenticateRequest, AuthError, authErrorResponse, requireRole } from "../_shared/auth.ts";
import { tenantSender } from "../_shared/emailSenders.ts";
import { getTenantBrand, renderTenantEmail } from "../_shared/tenantEmail.ts";
import { printTexts, renderReceiptHtml } from "../_shared/horecaPrint.ts";
import { isMailAddress, MAILS_PER_DAY, MAILS_PER_PAYMENT, receiptModelFromData, sha256Hex, type ReceiptData } from "../_shared/horecaReceipt.ts";

const VERSION = "PRINT-2";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Db = any;

async function stripeEmail(db: Db, tenantId: string, sessionId: string | null): Promise<string | null> {
  if (!sessionId) return null;
  const { data: t } = await db.from("tenants").select("stripe_account_id").eq("id", tenantId).maybeSingle();
  const account = (t as { stripe_account_id?: string } | null)?.stripe_account_id;
  if (!account) return null;
  const Stripe = (await import("https://esm.sh/stripe@14.21.0")).default;
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2023-10-16" });
  const s = await stripe.checkout.sessions.retrieve(sessionId, { stripeAccount: account });
  const email = (s as { customer_details?: { email?: string | null } | null }).customer_details?.email ?? null;
  return isMailAddress(email) ? email.trim() : null;
}

async function send(db: Db, d: ReceiptData, to: string) {
  const brand = await getTenantBrand(db, d.tenant_id);
  const locale = brand.defaultLocale;
  const L = printTexts(locale);
  const model = receiptModelFromData(d);
  const { html, text } = renderTenantEmail({
    tenantBrand: brand,
    locale,
    preheader: L.mailIntro(brand.tenantName),
    heading: L.mailHeading,
    intro: `<p>${L.mailIntro(brand.tenantName).replace(/[<>&]/g, "")}</p>`,
    content: renderReceiptHtml(model, locale),
  });
  const sender = tenantSender(brand.senderSource);
  const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
  const r = await resend.emails.send({ from: sender.from, reply_to: sender.replyTo, to: [to], subject: L.mailSubject(brand.tenantName), html, text });
  if (r.error) throw new Error(`Resend: ${r.error.message}`);
  return r.data?.id ?? null;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: VERSION });

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => null) as { source?: string; payment_id?: string; email?: string } | null;
    const source = body?.source === "online" ? "online" : body?.source === "kassa" ? "kassa" : null;
    const paymentId = body?.payment_id ?? "";
    if (!source || !UUID.test(paymentId)) return json({ error: "source and payment_id required" }, 400);

    // Kassa: eerst de sessie (een onbekend of fiscaal betaal-id verraadt niets aan wie niet aangemeld is).
    const auth = source === "kassa" ? await authenticateRequest(req) : null;
    if (source === "online") {
      const internalSecret = req.headers.get("X-Internal-Secret")?.trim();
      const { data: secretRow } = await db.from("internal_config").select("value").eq("key", "internal_webhook_secret").maybeSingle();
      const expected = (secretRow?.value as string | undefined)?.trim();
      if (!internalSecret || !expected || internalSecret !== expected) return json({ error: "Unauthorized internal call" }, 401);
    }

    const { data } = await db.rpc("horeca_receipt_data", { p_source: source, p_id: paymentId });
    const d = data as ReceiptData | null;
    if (!d) return json({ error: "payment not found" }, 404);
    if (auth) requireRole(auth, d.tenant_id, ["tenant_admin", "staff"]);
    if (d.fiscal) return json({ skipped: "fiscal" });
    const { data: s } = await db.from("horeca_pay_settings").select("mail_online, mail_button").eq("tenant_id", d.tenant_id).maybeSingle();

    let to: string | null;
    if (source === "online") {
      if (!s?.mail_online) return json({ skipped: "off" });
      if (d.status !== "paid") return json({ skipped: "not_paid" });
      const { count } = await db.from("horeca_receipt_mails").select("id", { count: "exact", head: true }).eq("source", "online").eq("payment_id", paymentId);
      if ((count ?? 0) > 0) return json({ skipped: "already_sent" });
      to = await stripeEmail(db, d.tenant_id, d.stripe_session_id);
      if (!to) return json({ skipped: "no_email" });
    } else {
      if (s && s.mail_button === false) return json({ error: "mail_button_off" }, 409);
      to = typeof body?.email === "string" ? body.email.trim() : "";
      if (!isMailAddress(to)) return json({ error: "invalid_email" }, 400);
    }

    // Eerst vastleggen, dan versturen. Online: de unieke index laat maar één rij per betaling toe.
    // Kassa: na het vastleggen tellen (eigen rij inbegrepen); boven het plafond weer weg.
    const { data: row, error: insErr } = await db.from("horeca_receipt_mails").insert({
      tenant_id: d.tenant_id, source, payment_id: paymentId, email_sha256: await sha256Hex(to.toLowerCase()), sent_by: auth?.user_id ?? null,
    }).select("id").single();
    if (insErr || !row) {
      if ((insErr as { code?: string } | null)?.code === "23505") return json({ skipped: "already_sent" });
      return json({ error: insErr?.message ?? "log" }, 500);
    }
    if (source === "kassa") {
      const [perPayment, perDay] = await Promise.all([
        db.from("horeca_receipt_mails").select("id", { count: "exact", head: true }).eq("payment_id", paymentId),
        db.from("horeca_receipt_mails").select("id", { count: "exact", head: true }).eq("tenant_id", d.tenant_id)
          .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString()),
      ]);
      if ((perPayment.count ?? 0) > MAILS_PER_PAYMENT || (perDay.count ?? 0) > MAILS_PER_DAY) {
        await db.from("horeca_receipt_mails").delete().eq("id", row.id);
        return json({ error: "limit" }, 429);
      }
    }
    try {
      const id = await send(db, d, to);
      if (id) await db.from("horeca_receipt_mails").update({ resend_id: id }).eq("id", row.id);
      return json({ sent: true });
    } catch (e) {
      // Mislukt: de rij weer weg. Kassa: opnieuw tikken kan. Online: er volgt geen automatische nieuwe
      // poging (de trigger vuurt één keer); de fout staat in de functielogs.
      await db.from("horeca_receipt_mails").delete().eq("id", row.id);
      throw e;
    }
  } catch (error: unknown) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Error in horeca-receipt-mail:", msg);
    return json({ error: msg }, 500);
  }
});
