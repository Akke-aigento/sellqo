// TICKET-1 fase 4b — bevestigingsmail met QR-tickets.
//
// Volgt exact het patroon van send-order-confirmation: neemt { order_id },
// haalt zelf alles op, tenant-branding via _shared/tenantEmail.ts, meertalig
// via resolveEmailLocale + t(). Wordt non-blocking aangeroepen.
//
// Geen ticket_instances voor de order → skip (veilig bij onbedoelde aanroep).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { EMAIL_SENDERS } from "../_shared/emailSenders.ts";
import {
  getTenantBrand,
  renderTenantEmail,
  resolveEmailLocale,
  type TenantLocale,
} from "../_shared/tenantEmail.ts";
import { t } from "../_shared/tenantEmailI18n.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  console.log(`[SEND-TICKET-CONFIRMATION] ${step}`, details ? JSON.stringify(details) : "");
};

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const DATE_LOCALES: Record<TenantLocale, string> = {
  nl: "nl-NL", en: "en-GB", fr: "fr-FR", de: "de-DE",
};

function formatDate(dateStr: string | null, locale: TenantLocale): string {
  if (!dateStr) return "";
  try {
    return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(DATE_LOCALES[locale], {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(start: string | null, end: string | null): string {
  const trim = (v: string | null) => (v ? String(v).slice(0, 5) : "");
  const s = trim(start);
  const e = trim(end);
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await authenticateRequest(req);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { order_id } = await req.json();
    if (!order_id) throw new Error("order_id is required");

    log("Processing", { order_id });

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_number, customer_email, customer_name, locale, tenant_id, shipping_address")
      .eq("id", order_id)
      .single();

    if (orderError || !order) throw new Error(`Order not found: ${orderError?.message}`);

    const { data: tickets, error: ticketsError } = await supabase
      .from("ticket_instances")
      .select(`
        id, qr_token, seq, attendee_name, attendee_email, status, order_item_id,
        event_details!ticket_instances_event_detail_id_fkey ( event_date, start_time, end_time, location_name, meeting_point ),
        order_items!ticket_instances_order_item_id_fkey ( product_name )
      `)
      .eq("order_id", order_id)
      .order("seq", { ascending: true });

    if (ticketsError) throw new Error(`Ticket lookup failed: ${ticketsError.message}`);

    if (!tickets || tickets.length === 0) {
      log("No tickets for order — skipping", { order_id });
      return new Response(JSON.stringify({ skipped: true, reason: "no ticket_instances" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipient = order.customer_email || tickets.find((x: any) => x.attendee_email)?.attendee_email;
    if (!recipient) {
      return new Response(JSON.stringify({ skipped: true, reason: "no recipient email" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = order.tenant_id;

    // Tenant-toggle (customer_communication_settings, trigger_type ticket_delivery)
    const { data: commSettings } = await supabase
      .from("customer_communication_settings")
      .select("email_enabled")
      .eq("tenant_id", tenantId)
      .eq("trigger_type", "ticket_delivery")
      .maybeSingle();

    if (commSettings && commSettings.email_enabled === false) {
      log("Ticket delivery disabled by tenant", { tenantId });
      return new Response(JSON.stringify({ skipped: true, reason: "ticket_delivery disabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const brand = await getTenantBrand(supabase, tenantId);
    const locale: TenantLocale = await resolveEmailLocale(supabase, {
      explicit: (order as any).locale,
      tenantId,
      countryCode: (order as any).shipping_address?.country,
      tenantDefault: brand.defaultLocale,
    });

    const total = tickets.length;
    const eventName =
      (tickets[0] as any)?.order_items?.product_name ||
      (locale === "nl" ? "je event" : locale === "fr" ? "votre événement" : locale === "de" ? "Ihr Event" : "your event");

    const blocks = tickets.map((tk: any, i: number) => {
      const ev = tk.event_details || {};
      const qrUrl = `${supabaseUrl}/functions/v1/ticket-qr?token=${encodeURIComponent(tk.qr_token)}&size=220`;
      const rows: string[] = [];
      const addRow = (label: string, value: string) => {
        if (!value) return;
        rows.push(
          `<tr><td style="padding:2px 12px 2px 0;font-size:13px;color:${brand.mutedColor};white-space:nowrap;">${esc(label)}</td>` +
            `<td style="padding:2px 0;font-size:13px;color:${brand.textColor};font-weight:600;">${esc(value)}</td></tr>`,
        );
      };
      addRow(t(locale, "ticket.dateLabel"), formatDate(ev.event_date, locale));
      addRow(t(locale, "ticket.timeLabel"), formatTime(ev.start_time, ev.end_time));
      addRow(t(locale, "ticket.locationLabel"), ev.location_name || "");
      addRow(t(locale, "ticket.meetingPointLabel"), ev.meeting_point || "");
      if (tk.attendee_name) addRow(t(locale, "ticket.attendeeLabel"), tk.attendee_name);

      return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;border:1px solid ${brand.borderColor};border-radius:10px;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${brand.mutedColor};">${esc(
            t(locale, "ticket.ticketLabel", { index: i + 1, total }),
          )}</p>
          <p style="margin:0 0 12px;font-size:17px;font-weight:700;color:${brand.textColor};">${esc(
            tk.order_items?.product_name || eventName,
          )}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">${rows.join("")}</table>
          <div style="text-align:center;">
            <img src="${qrUrl}" width="220" height="220" alt="QR ${esc(
              t(locale, "ticket.ticketLabel", { index: i + 1, total }),
            )}" style="display:block;margin:0 auto;border:0;outline:none;background:#ffffff;padding:10px;border-radius:8px;" />
            <p style="margin:10px 0 0;font-size:11px;color:${brand.mutedColor};font-family:monospace;word-break:break-all;">${esc(
              t(locale, "ticket.codeLabel"),
            )}: ${esc(tk.qr_token)}</p>
          </div>
        </td></tr>
      </table>`;
    });

    const content = `
      <p style="margin:16px 0 0;font-size:14px;line-height:1.6;">${esc(t(locale, "ticket.instructions"))}</p>
      ${blocks.join("")}
      <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:${brand.mutedColor};">${esc(
        t(locale, "ticket.disclaimer"),
      )}</p>
    `;

    const { html, text } = renderTenantEmail({
      tenantBrand: brand,
      locale,
      preheader: t(locale, "ticket.instructions"),
      heading: t(locale, "ticket.heading"),
      intro: `<p>${esc(
        t(locale, "ticket.intro", {
          customerName: order.customer_name || (locale === "nl" ? "Klant" : "there"),
          ticketCount: total,
        }),
      )}</p>`,
      content,
      footerNote: t(locale, "ticket.footerNote"),
      poweredByLabel: t(locale, "ticket.poweredBy"),
    });

    const subject = t(locale, "ticket.subject", { eventName });

    log("Sending", { to: recipient, tickets: total });

    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const resend = new Resend(resendApiKey);
    const sender = EMAIL_SENDERS.tickets(brand.tenantName, brand.supportEmail);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: sender.from,
      to: [recipient],
      subject,
      html,
      text,
      reply_to: sender.replyTo,
    });

    if (emailError) throw new Error(`Email verzenden mislukt: ${emailError.message}`);

    log("Sent", { id: emailData?.id });
    return new Response(JSON.stringify({ success: true, email_id: emailData?.id, tickets: total }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    log("Error", { message: error?.message ?? String(error) });
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
