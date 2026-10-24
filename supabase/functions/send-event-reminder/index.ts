// EVENT-REMINDER-1 — dag-van herinneringsmail aan tickethouders.
// EVENT-REMINDER-2 — inhaalmail voor laatkomers.
//
// Aangeroepen door cron elke 10 minuten (08:00–22:50 UTC) via net.http_post.
// Zoekt events met event_date = vandaag (in de tijdzone van het event),
// status = 'scheduled' en een whatsapp_url, tot 2 uur na de start.
// Stuurt elke geldige tickethouder die de mail nog niet kreeg een
// herinneringsmail met event-info + WhatsApp-groeplink. De eerste run
// (10:00 Brussel) stuurt dus de grote batch; latere runs enkel wie na die
// batch een ticket kocht.
//
// Dubbel versturen: per ticket een claim (ticket_instances.reminder_sent_at
// zetten waar die nog null is). Mislukt de mail, dan wordt de claim weer
// vrijgegeven zodat de volgende run het opnieuw probeert.
// event_details.reminder_sent_at = tijdstip van de eerste verzending.
//
// Auth: alleen cron of andere functies (denyUnlessCron, zoals
// process-cycle-reminders). GET is een neveneffectvrije healthcheck.
//
// Volgt het send-ticket-confirmation patroon: tenant-branding via
// _shared/tenantEmail.ts, afzender via _shared/emailSenders.ts.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { denyUnlessCron } from "../_shared/marketplaceSyncAuth.ts";
import { tenantSender } from "../_shared/emailSenders.ts";
import {
  getTenantBrand,
  renderTenantEmail,
  resolveEmailLocale,
  type TenantLocale,
} from "../_shared/tenantEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) =>
  console.log(
    `[SEND-EVENT-REMINDER] ${step}`,
    details ? JSON.stringify(details) : ""
  );

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Inline i18n — NL/EN/FR/DE. Compact: alleen wat de reminder nodig heeft.
const REMINDER_STRINGS: Record<
  TenantLocale,
  {
    subject: string;
    heading: string;
    intro: string;
    checklist: string[];
    whatsappCta: string;
    whatsappNote: string;
    footer: string;
    poweredBy: string;
  }
> = {
  nl: {
    subject: "Vanavond: {eventName} om {startTime} 🎉",
    heading: "Het is zover!",
    intro:
      "Hi {name}, nog even en het begint. Snelle checklist:",
    checklist: [
      "📍 {startTime} stipt op {meetingPoint}{locationSuffix}",
      "🎫 Neem je ticket mee (de QR-code uit je eerdere mail)",
      "🪪 Breng je ID mee (18+)",
      "🍝 Eet iets vooraf. Vertrouw ons.",
    ],
    whatsappCta: "Join de WhatsApp-groep",
    whatsappNote:
      "Te laat of verdwaald? Stuur een berichtje in de groep en je gids vertelt je waar we zitten.",
    footer: "Tot straks!",
    poweredBy: "Mogelijk gemaakt door SellQo",
  },
  en: {
    subject: "Tonight: {eventName} at {startTime} 🎉",
    heading: "It's happening!",
    intro:
      "Hi {name}, just a few hours to go. Quick checklist:",
    checklist: [
      "📍 {startTime} sharp at {meetingPoint}{locationSuffix}",
      "🎫 Bring your ticket (the QR code from your earlier email)",
      "🪪 Bring your ID (18+)",
      "🍝 Eat something first. Trust us.",
    ],
    whatsappCta: "Join the WhatsApp group",
    whatsappNote:
      "Running late or lost? Drop a message in the group and your guide will tell you where we are.",
    footer: "See you there!",
    poweredBy: "Powered by SellQo",
  },
  fr: {
    subject: "Ce soir : {eventName} à {startTime} 🎉",
    heading: "C'est le jour J !",
    intro:
      "Bonjour {name}, plus que quelques heures. Petit check :",
    checklist: [
      "📍 {startTime} pile à {meetingPoint}{locationSuffix}",
      "🎫 Apportez votre billet (le QR code de votre e-mail précédent)",
      "🪪 Apportez votre pièce d'identité (18+)",
      "🍝 Mangez avant. Faites-nous confiance.",
    ],
    whatsappCta: "Rejoindre le groupe WhatsApp",
    whatsappNote:
      "En retard ou perdu ? Envoyez un message dans le groupe et votre guide vous dira où nous sommes.",
    footer: "À ce soir !",
    poweredBy: "Propulsé par SellQo",
  },
  de: {
    subject: "Heute Abend: {eventName} um {startTime} 🎉",
    heading: "Es ist soweit!",
    intro:
      "Hallo {name}, nur noch wenige Stunden. Kurze Checkliste:",
    checklist: [
      "📍 {startTime} pünktlich am {meetingPoint}{locationSuffix}",
      "🎫 Ticket mitbringen (den QR-Code aus Ihrer früheren E-Mail)",
      "🪪 Ausweis mitbringen (18+)",
      "🍝 Vorher essen. Vertrauen Sie uns.",
    ],
    whatsappCta: "WhatsApp-Gruppe beitreten",
    whatsappNote:
      "Zu spät oder verlaufen? Schreiben Sie in die Gruppe und Ihr Guide sagt Ihnen, wo wir sind.",
    footer: "Bis heute Abend!",
    poweredBy: "Bereitgestellt von SellQo",
  },
};

function interpolate(
  template: string,
  vars: Record<string, string>
): string {
  let s = template;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replaceAll(`{${k}}`, v);
  }
  return s;
}

function formatTime(t: string | null): string {
  return t ? String(t).slice(0, 5) : "";
}

// Datum (JJJJ-MM-DD) en minuten sinds middernacht in een tijdzone.
function localNow(timeZone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function toMinutes(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
}

// Hoe lang na de start laatkomers nog een mail krijgen.
const LATE_WINDOW_MINUTES = 120;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  // Healthcheck (GET) — gedragsvingerafdruk na deploy.
  if (req.method === "GET")
    return new Response(
      JSON.stringify({ ok: true, version: "EVENT-REMINDER-2" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const denied = await denyUnlessCron(req, supabase, corsHeaders);
    if (denied) return denied;

    // Kandidaten: gisteren t/m morgen in UTC; per event wordt daarna
    // "vandaag" in de eigen tijdzone gecontroleerd.
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const from = new Date(now - day).toISOString().slice(0, 10);
    const to = new Date(now + day).toISOString().slice(0, 10);

    const { data: candidates, error: evErr } = await supabase
      .from("event_details")
      .select(
        "id, event_date, start_time, end_time, meeting_point, location_name, whatsapp_url, tenant_id, product_id, timezone, reminder_sent_at"
      )
      .gte("event_date", from)
      .lte("event_date", to)
      .eq("status", "scheduled")
      .not("whatsapp_url", "is", null);

    if (evErr) throw new Error(`Event lookup failed: ${evErr.message}`);

    const events = (candidates || []).filter((ev) => {
      const local = localNow(ev.timezone || "Europe/Brussels");
      if (local.date !== ev.event_date) return false;
      const start = toMinutes(ev.start_time);
      return start === null || local.minutes <= start + LATE_WINDOW_MINUTES;
    });

    if (events.length === 0) {
      log("No events today needing reminders");
      return new Response(
        JSON.stringify({ ok: true, events: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Events to remind", { count: events.length });

    let totalSent = 0;

    for (const ev of events) {
      // Product naam ophalen.
      const { data: product } = await supabase
        .from("products")
        .select("name")
        .eq("id", ev.product_id)
        .single();

      const eventName = product?.name || "Event";

      // Tenant branding.
      const brand = await getTenantBrand(supabase, ev.tenant_id);

      // Tenant communicatie-instelling check.
      const { data: commSettings } = await supabase
        .from("customer_communication_settings")
        .select("email_enabled")
        .eq("tenant_id", ev.tenant_id)
        .eq("trigger_type", "ticket_delivery")
        .maybeSingle();

      if (commSettings && commSettings.email_enabled === false) {
        log("Ticket delivery disabled by tenant", { tenantId: ev.tenant_id });
        continue;
      }

      // Geldige tickets voor dit event.
      const { data: tickets, error: tkErr } = await supabase
        .from("ticket_instances")
        .select("id, attendee_name, attendee_email, order_id, reminder_sent_at")
        .eq("event_detail_id", ev.id)
        .in("status", ["valid", "checked_in"]);

      if (tkErr) {
        log("Ticket lookup failed", { eventId: ev.id, error: tkErr.message });
        continue;
      }

      // Wie de mail al kreeg (via een ander ticket), krijgt hem niet opnieuw.
      const alreadyMailed = new Set(
        (tickets || [])
          .filter((tk) => tk.reminder_sent_at)
          .map((tk) => (tk.attendee_email || "").toLowerCase().trim())
      );
      const pending = (tickets || []).filter((tk) => !tk.reminder_sent_at);
      if (pending.length === 0) {
        log("Nothing pending", { eventId: ev.id });
        continue;
      }

      // Claim: alleen tickets die we zelf van null naar nu zetten.
      const claimedAt = new Date().toISOString();
      const { data: claimed, error: claimErr } = await supabase
        .from("ticket_instances")
        .update({ reminder_sent_at: claimedAt })
        .in("id", pending.map((tk) => tk.id))
        .is("reminder_sent_at", null)
        .select("id, attendee_name, attendee_email, order_id");
      if (claimErr) {
        log("Claim failed", { eventId: ev.id, error: claimErr.message });
        continue;
      }
      if (!claimed || claimed.length === 0) {
        log("Already claimed — skipping", { eventId: ev.id });
        continue;
      }

      // Dedup op e-mail (meerdere tickets, één mail per persoon).
      const recipients: {
        email: string;
        name: string;
        orderId: string;
        ticketIds: string[];
      }[] = [];
      const byEmail = new Map<string, (typeof recipients)[number]>();
      for (const tk of claimed) {
        const email = (tk.attendee_email || "").toLowerCase().trim();
        if (!email || alreadyMailed.has(email)) continue;
        const existing = byEmail.get(email);
        if (existing) {
          existing.ticketIds.push(tk.id);
          continue;
        }
        const r = {
          email,
          name: tk.attendee_name || "",
          orderId: tk.order_id,
          ticketIds: [tk.id],
        };
        byEmail.set(email, r);
        recipients.push(r);
      }

      let eventSent = 0;
      const failedTicketIds: string[] = [];

      log("Sending reminders", {
        eventId: ev.id,
        eventName,
        recipients: recipients.length,
      });

      const { Resend } = await import("https://esm.sh/resend@2.0.0");
      const resend = new Resend(resendApiKey);
      const sender = tenantSender(brand.senderSource);

      const startTime = formatTime(ev.start_time);
      const locationSuffix = ev.location_name
        ? ` (${ev.location_name})`
        : "";

      for (const r of recipients) {
        // Locale: ophalen uit de order.
        const { data: order } = await supabase
          .from("orders")
          .select("locale, shipping_address")
          .eq("id", r.orderId)
          .single();

        const locale: TenantLocale = await resolveEmailLocale(supabase, {
          explicit: order?.locale,
          tenantId: ev.tenant_id,
          countryCode: order?.shipping_address?.country,
          tenantDefault: brand.defaultLocale,
        });

        const strings = REMINDER_STRINGS[locale] || REMINDER_STRINGS.en;

        const vars = {
          name: r.name || (locale === "nl" ? "daar" : "there"),
          eventName,
          startTime,
          meetingPoint: ev.meeting_point || ev.location_name || "",
          locationSuffix,
        };

        const subject = interpolate(strings.subject, vars);

        // Checklist items als HTML.
        const checklistHtml = strings.checklist
          .map(
            (item) =>
              `<li style="margin:6px 0;font-size:15px;line-height:1.5;color:${brand.textColor};">${esc(interpolate(item, vars))}</li>`
          )
          .join("");

        const whatsappButtonColor = "#25D366";

        const content = `
          <p style="margin:16px 0;font-size:15px;line-height:1.6;color:${brand.textColor};">
            ${esc(interpolate(strings.intro, vars))}
          </p>
          <ul style="margin:16px 0;padding-left:0;list-style:none;">
            ${checklistHtml}
          </ul>
          ${
            ev.whatsapp_url
              ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
            <tr><td align="center">
              <a href="${esc(ev.whatsapp_url)}"
                 style="display:inline-block;padding:14px 28px;border-radius:10px;background:${whatsappButtonColor};color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;">
                💬 ${esc(strings.whatsappCta)}
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:${brand.mutedColor};text-align:center;">
            ${esc(strings.whatsappNote)}
          </p>`
              : ""
          }
          <p style="margin:24px 0 0;font-size:15px;font-weight:600;color:${brand.textColor};">
            ${esc(strings.footer)}
          </p>
        `;

        const { html, text } = renderTenantEmail({
          tenantBrand: brand,
          locale,
          preheader: interpolate(strings.subject, vars),
          heading: strings.heading,
          intro: "",
          content,
          footerNote: "",
          poweredByLabel: strings.poweredBy,
        });

        try {
          const { error: emailErr } = await resend.emails.send({
            from: sender.from,
            to: [r.email],
            subject,
            html,
            text,
            reply_to: sender.replyTo,
          });
          if (emailErr) {
            log("Email failed", { email: r.email, error: emailErr.message });
            failedTicketIds.push(...r.ticketIds);
          } else {
            totalSent++;
            eventSent++;
            log("Sent", { email: r.email });
          }
        } catch (e: unknown) {
          log("Email exception", { email: r.email, error: e instanceof Error ? e.message : String(e) });
          failedTicketIds.push(...r.ticketIds);
        }
      }

      // Mislukt: claim vrijgeven zodat de volgende run het opnieuw probeert.
      if (failedTicketIds.length > 0) {
        const { error: releaseErr } = await supabase
          .from("ticket_instances")
          .update({ reminder_sent_at: null })
          .in("id", failedTicketIds)
          .eq("reminder_sent_at", claimedAt);
        if (releaseErr) {
          log("Failed to release claim", { eventId: ev.id, error: releaseErr.message });
        } else {
          log("Claim released", { eventId: ev.id, tickets: failedTicketIds.length });
        }
      }

      // Eerste verzending van dit event vastleggen.
      if (eventSent > 0 && !ev.reminder_sent_at) {
        await supabase
          .from("event_details")
          .update({ reminder_sent_at: claimedAt })
          .eq("id", ev.id)
          .is("reminder_sent_at", null);
      }
    }

    log("Done", { totalSent });
    return new Response(
      JSON.stringify({ ok: true, sent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log("Error", { message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
