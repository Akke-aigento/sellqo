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
import { tenantSender } from "../_shared/emailSenders.ts";
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

/** Zwart of wit, naargelang de achtergrondkleur (#rrggbb). */
function fgOn(bg: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(bg.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#111111" : "#ffffff";
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
  if (req.method === "GET") return new Response(JSON.stringify({ ok: true, version: "FEST-2b" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
        event_detail_id, seat_label, product_id
      `)
      .eq("order_id", order_id)
      .order("seq", { ascending: true });

    if (ticketsError) throw new Error(`Ticket lookup failed: ${ticketsError.message}`);

    // FEST-2 — muntenkaart bij deze bestelling (drank- en etenbonnen).
    const { data: wallet } = await supabase
      .from("token_wallets")
      .select("code, purchased, balance")
      .eq("order_id", order_id)
      .maybeSingle();

    if ((!tickets || tickets.length === 0) && !wallet) {
      log("No tickets for order — skipping", { order_id });
      return new Response(JSON.stringify({ skipped: true, reason: "no ticket_instances" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Losse lookups i.p.v. PostgREST-embeds: minder afhankelijk van FK-hints.
    const eventIds = [...new Set(tickets.map((x: any) => x.event_detail_id).filter(Boolean))];
    const itemIds = [...new Set(tickets.map((x: any) => x.order_item_id).filter(Boolean))];

    const eventMap = new Map<string, any>();
    if (eventIds.length) {
      const { data: evs } = await supabase
        .from("event_details")
        .select("id, event_date, start_time, end_time, location_name, meeting_point")
        .in("id", eventIds);
      for (const e of evs || []) eventMap.set(e.id, e);
    }

    const itemMap = new Map<string, any>();
    if (itemIds.length) {
      const { data: its } = await supabase
        .from("order_items")
        .select("id, product_name, product_id")
        .in("id", itemIds);
      for (const it of its || []) itemMap.set(it.id, it);
    }

    // FEST-1 — combitickets: per ticket de naam van het onderdeel (dagticket, camping),
    // met de combi eronder. Gewone tickets houden exact hun huidige titel.
    const componentName = new Map<string, string>();
    const bundleProductIds = [...new Set([...itemMap.values()].map((it: { product_id?: string }) => it.product_id).filter(Boolean))] as string[];
    if (bundleProductIds.length) {
      const { data: bItems } = await supabase
        .from("ticket_bundle_items")
        .select("bundle_product_id")
        .in("bundle_product_id", bundleProductIds);
      const bundles = new Set(((bItems || []) as { bundle_product_id: string }[]).map((b) => b.bundle_product_id));
      const compIds = [...new Set((tickets || [])
        .filter((tk: { order_item_id: string }) => bundles.has(itemMap.get(tk.order_item_id)?.product_id))
        .map((tk: { product_id: string }) => tk.product_id))] as string[];
      if (compIds.length) {
        const { data: comps } = await supabase.from("products").select("id, name").in("id", compIds);
        for (const c of (comps || []) as { id: string; name: string }[]) componentName.set(c.id, c.name);
      }
      // Alleen tickets die uit een combi komen, krijgen de onderdeelnaam.
      for (const tk of (tickets || []) as { id: string; order_item_id: string; product_id: string }[]) {
        if (bundles.has(itemMap.get(tk.order_item_id)?.product_id) && componentName.has(tk.product_id)) {
          componentName.set(`ticket:${tk.id}`, componentName.get(tk.product_id)!);
        }
      }
    }

    // ZAAL-2/3 — stoel per ticket (alleen bij een datum met zaalplan).
    type SeatRow = { ticket_instance_id: string; section_name: string; row_label: string; seat_number: string };
    type TicketRow = { id: string; seat_label: string | null };
    const seatMap = new Map<string, SeatRow>();
    if ((tickets as TicketRow[]).some((x) => x.seat_label)) {
      const { data: seats } = await supabase
        .from("event_seats")
        .select("ticket_instance_id, section_name, row_label, seat_number")
        .in("ticket_instance_id", (tickets as TicketRow[]).map((x) => x.id));
      for (const st of (seats || []) as SeatRow[]) seatMap.set(st.ticket_instance_id, st);
    }

    const recipient = order.customer_email || (tickets || []).find((x: any) => x.attendee_email)?.attendee_email;
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

    const total = (tickets || []).length;
    const eventName =
      itemMap.get((tickets?.[0] as any)?.order_item_id)?.product_name ||
      (locale === "nl" ? "je event" : locale === "fr" ? "votre événement" : locale === "de" ? "Ihr Event" : "your event");

    const blocks = (tickets || []).map((tk: any, i: number) => {
      const ev = eventMap.get(tk.event_detail_id) || {};
      const item = itemMap.get(tk.order_item_id) || {};
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
      const seat = seatMap.get(tk.id);
      if (seat) {
        addRow(t(locale, "ticket.seatLabel"), `${seat.section_name} · ${t(locale, "ticket.rowWord")} ${seat.row_label} · ${t(locale, "ticket.seatWord")} ${seat.seat_number}`);
      } else if (tk.seat_label) {
        addRow(t(locale, "ticket.seatLabel"), tk.seat_label);
      }
      if (tk.attendee_name) addRow(t(locale, "ticket.attendeeLabel"), tk.attendee_name);

      return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;border:1px solid ${brand.borderColor};border-radius:10px;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${brand.mutedColor};">${esc(
            t(locale, "ticket.ticketLabel", { index: i + 1, total }),
          )}</p>
          <p style="margin:0 0 12px;font-size:17px;font-weight:700;color:${brand.textColor};">${esc(
            componentName.get(`ticket:${tk.id}`) || item.product_name || eventName,
          )}${componentName.has(`ticket:${tk.id}`) && item.product_name
            ? `<span style="display:block;margin-top:2px;font-size:13px;font-weight:400;color:${brand.mutedColor};">${esc(item.product_name)}</span>`
            : ""}</p>
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

    // FEST-2 — muntenblok: één QR voor alle munten, plus link naar de muntenpagina.
    let walletBlock = "";
    let tokenNamePlural = "munten";
    if (wallet) {
      const { data: ts } = await supabase
        .from("token_settings")
        .select("token_name_plural")
        .eq("tenant_id", order.tenant_id)
        .maybeSingle();
      tokenNamePlural = (ts?.token_name_plural as string) || ({ nl: "munten", en: "tokens", fr: "jetons", de: "Marken" } as Record<TenantLocale, string>)[locale];
      const tVars = {
        count: Number(wallet.balance),
        tokenNamePlural,
        tokenNamePluralCap: tokenNamePlural.charAt(0).toUpperCase() + tokenNamePlural.slice(1),
      };
      const appUrl = (Deno.env.get("PUBLIC_APP_URL") || "https://sellqo.app").replace(/\/$/, "");
      const walletUrl = `${appUrl}/munten/${encodeURIComponent(wallet.code as string)}`;
      const qrUrl = `${supabaseUrl}/functions/v1/ticket-qr?token=${encodeURIComponent(wallet.code as string)}&size=220`;
      walletBlock = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;border:2px solid ${brand.primaryColor};border-radius:10px;">
        <tr><td style="padding:20px;text-align:center;">
          <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:${brand.textColor};">${esc(t(locale, "ticket.walletHeading", tVars))}</p>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${brand.mutedColor};">${esc(t(locale, "ticket.walletBody", tVars))}</p>
          <img src="${qrUrl}" width="220" height="220" alt="QR ${esc(tokenNamePlural)}" style="display:block;margin:0 auto;border:0;outline:none;background:#ffffff;padding:10px;border-radius:8px;" />
          <p style="margin:16px 0 0;"><a href="${esc(walletUrl)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:${brand.primaryColor};color:${fgOn(brand.primaryColor)};font-weight:600;font-size:14px;text-decoration:none;">${esc(t(locale, "ticket.walletLink"))}</a></p>
          <p style="margin:12px 0 0;font-size:12px;color:${brand.mutedColor};">${esc(t(locale, "ticket.walletRefund", tVars))}</p>
        </td></tr>
      </table>`;
    }

    const content = `
      ${total > 0 ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;">${esc(t(locale, "ticket.instructions"))}</p>` : ""}
      ${blocks.join("")}
      ${walletBlock}
      ${total > 0 ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:${brand.mutedColor};">${esc(
        t(locale, "ticket.disclaimer"),
      )}</p>` : ""}
    `;

    const { html, text } = renderTenantEmail({
      tenantBrand: brand,
      locale,
      preheader: t(locale, "ticket.instructions"),
      heading: total > 0 ? t(locale, "ticket.heading") : t(locale, "ticket.walletMailHeading", { tokenNamePlural }),
      intro: `<p>${esc(
        total > 0
          ? t(locale, "ticket.intro", {
            customerName: order.customer_name || (locale === "nl" ? "Klant" : "there"),
            ticketCount: total,
          })
          : t(locale, "ticket.walletIntro", {
            customerName: order.customer_name || (locale === "nl" ? "Klant" : "there"),
            tokenNamePlural,
          }),
      )}</p>`,
      content,
      footerNote: t(locale, "ticket.footerNote"),
      poweredByLabel: t(locale, "ticket.poweredBy"),
    });

    const subject = total > 0
      ? t(locale, "ticket.subject", { eventName })
      : t(locale, "ticket.walletSubject", { tokenNamePlural, shopName: brand.tenantName });

    log("Sending", { to: recipient, tickets: total, wallet: !!wallet });

    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const resend = new Resend(resendApiKey);
    const sender = tenantSender(brand.senderSource);

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
