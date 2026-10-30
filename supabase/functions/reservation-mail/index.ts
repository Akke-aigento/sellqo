// RESERVATIE-2 — mail aan een gast die online reserveerde, zodra het personeel bevestigt of weigert.
// Enkel aangeroepen door de databank (trigger reservation_mail_tr, X-Internal-Secret). Eén mail per
// reservatie (mail_sent_at wordt eerst gezet; lukt het versturen niet, dan weer leeggemaakt).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { tenantSender } from "../_shared/emailSenders.ts";
import { getTenantBrand, renderTenantEmail } from "../_shared/tenantEmail.ts";
import { reservationMail, type ReservationOutcome } from "../_shared/reservationMail.ts";

const VERSION = "RESERVATIE-2";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: VERSION });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const internalSecret = req.headers.get("X-Internal-Secret")?.trim();
    const { data: secretRow } = await db.from("internal_config").select("value").eq("key", "internal_webhook_secret").maybeSingle();
    const expected = (secretRow?.value as string | undefined)?.trim();
    if (!internalSecret || !expected || internalSecret !== expected) return json({ error: "Unauthorized internal call" }, 401);

    const body = await req.json().catch(() => null) as { reservation_id?: string } | null;
    const id = body?.reservation_id ?? "";
    if (!UUID.test(id)) return json({ error: "reservation_id required" }, 400);

    const { data: r } = await db.from("table_reservations")
      .select("id, tenant_id, name, guests, email, starts_at, status, source, mail_sent_at").eq("id", id).maybeSingle();
    if (!r) return json({ error: "not found" }, 404);
    if (r.source !== "online" || !r.email) return json({ skipped: "not_online" });
    if (r.status !== "booked" && r.status !== "declined") return json({ skipped: "status" });
    if (r.mail_sent_at) return json({ skipped: "already_sent" });

    // Eerst vastleggen (een tweede aanroep stopt hierboven), dan versturen.
    const { data: claimed } = await db.from("table_reservations").update({ mail_sent_at: new Date().toISOString() })
      .eq("id", id).is("mail_sent_at", null).select("id").maybeSingle();
    if (!claimed) return json({ skipped: "already_sent" });

    try {
      const brand = await getTenantBrand(db, r.tenant_id);
      const { data: fs } = await db.from("fulfillment_settings").select("timezone").eq("tenant_id", r.tenant_id).maybeSingle();
      const tz = (fs?.timezone as string | null) || "Europe/Brussels";
      const locale = brand.defaultLocale;
      const m = reservationMail(r.status as ReservationOutcome, { name: r.name, guests: r.guests, startsAt: r.starts_at, timezone: tz, shop: brand.tenantName }, locale);
      const { html, text } = renderTenantEmail({ tenantBrand: brand, locale, preheader: m.preheader, heading: m.heading, intro: m.intro, content: m.content });
      const sender = tenantSender(brand.senderSource);
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
      const sent = await resend.emails.send({ from: sender.from, reply_to: sender.replyTo, to: [r.email], subject: m.subject, html, text });
      if (sent.error) throw new Error(`Resend: ${sent.error.message}`);
      return json({ sent: true });
    } catch (e) {
      await db.from("table_reservations").update({ mail_sent_at: null }).eq("id", id);
      throw e;
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Error in reservation-mail:", msg);
    return json({ error: msg }, 500);
  }
});
