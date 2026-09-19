import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { renderSellqoEmail, htmlToPlainText } from "../_shared/sellqoEmail.ts";
import { EMAIL_SENDERS } from "../_shared/emailSenders.ts";
import { messageConversationKey, planEmail, MESSAGE_EMAIL_WINDOW_MS } from "../_shared/notificationDefaults.ts";
import { notificationRoute } from "../_shared/notificationRoutes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  tenant_id: string;
  category: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  action_url?: string;
  user_id?: string;
  notification_id?: string;
  skip_in_app?: boolean;
}

const prioritySubjects: Record<string, string> = {
  urgent: '🚨 URGENT: ',
  high: '⚠️ ',
  medium: '',
  low: '',
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody: NotificationRequest = await req.json();
    let notification: NotificationRequest = rawBody;

    // NOTIF-FIX-1: internal-trusted path (called by DB trigger notify_email_on_notification).
    // The trigger passes X-Internal-Secret; we verify against internal_config and re-fetch
    // the notification row from the DB (never trusting the payload contents for security).
    const internalSecretHeader = req.headers.get("X-Internal-Secret")?.trim();
    if (internalSecretHeader) {
      const { data: secretRow } = await supabase
        .from("internal_config")
        .select("value")
        .eq("key", "internal_webhook_secret")
        .maybeSingle();
      const expected = (secretRow?.value as string | undefined)?.trim();
      if (!expected || internalSecretHeader !== expected || !rawBody.notification_id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized internal call" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      const { data: notifRow, error: notifErr } = await supabase
        .from("notifications")
        .select("id, tenant_id, category, type, title, message, priority, action_url, data")
        .eq("id", rawBody.notification_id)
        .maybeSingle();
      if (notifErr || !notifRow) {
        return new Response(
          JSON.stringify({ error: "Notification not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      notification = {
        tenant_id: notifRow.tenant_id,
        category: notifRow.category,
        type: notifRow.type,
        title: notifRow.title,
        message: notifRow.message,
        priority: (notifRow.priority ?? "medium") as NotificationRequest["priority"],
        action_url: notifRow.action_url ?? undefined,
        data: (notifRow.data ?? {}) as Record<string, unknown>,
        notification_id: notifRow.id,
        skip_in_app: true,
      };
    } else {
      await authenticateRequest(req, rawBody.tenant_id);
    }

    const priority = notification.priority || 'medium';
    const skipInApp = notification.skip_in_app || false;
    let notificationId = notification.notification_id || null;

    // 1. Create the in-app notification (skip if already created by trigger)
    if (!skipInApp) {
      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .insert({
          tenant_id: notification.tenant_id,
          user_id: notification.user_id || null,
          category: notification.category,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data || {},
          priority,
          action_url: notification.action_url || null,
        })
        .select()
        .single();

      if (notificationError) {
        // NOTIF-SOURCES-1: een unieke index (bv. notifications_payout_once) wees
        // hem af — dezelfde melding bestaat al. Geen fout, zoals bij inbound.
        if ((notificationError as { code?: string }).code === '23505') {
          console.log('Duplicate notification skipped', { type: notification.type });
          return new Response(JSON.stringify({ success: true, duplicate: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
        console.error('Error creating notification:', notificationError);
        throw notificationError;
      }

      notificationId = notificationData.id;
      console.log('Notification created:', notificationId);

      // NOTIF-SOURCES-1: één mailplek. Deze insert vuurt de trigger
      // notify_email_on_notification, die ons intern (skip_in_app) opnieuw
      // aanroept en dán mailt. Hier ook mailen gaf elke tenant twee mails.
      return new Response(
        JSON.stringify({ success: true, notification_id: notificationId, email: 'via_trigger' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    } else {
      console.log('Skipping in-app creation, notification_id:', notificationId);
    }

    // 2. Check if email should be sent
    const { data: settings } = await supabase
      .from('tenant_notification_settings')
      .select('email_enabled, email_recipients')
      .eq('tenant_id', notification.tenant_id)
      .eq('category', notification.category)
      .eq('notification_type', notification.type)
      .single();

    // PUSH-DEFAULT-1: één bron. Een rij beslist; zonder rij de default van het type
    // (_shared/notificationDefaults.ts, gelijk aan NOTIFICATION_CONFIG), en high/urgent
    // mailen zoals voorheen altijd. Berichten: hooguit één mail per gesprek (kanaal +
    // afzender) per 15 minuten; in-app en push worden niet gethrottled.
    // NOTIF-SOURCES-1: de beslissing zit in planEmail (puur, getest); hier alleen de
    // lookup van recente mails voor de throttle.
    const conversationKey = notification.category === 'messages'
      ? messageConversationKey(notification.type, notification.data)
      : null;
    let recent: Array<{ key: string | null; emailSentAt: string | null }> = [];
    if (conversationKey) {
      const since = new Date(Date.now() - MESSAGE_EMAIL_WINDOW_MS).toISOString();
      const { data: recentRows, error: recentError } = await supabase
        .from('notifications')
        .select('id, type, data, email_sent_at')
        .eq('tenant_id', notification.tenant_id)
        .eq('category', 'messages')
        .eq('type', notification.type)
        .gte('email_sent_at', since);
      if (recentError) {
        // Liever een mail te veel dan een klantbericht dat niemand ziet.
        console.error('Throttle lookup failed, sending anyway:', recentError.message);
      } else {
        recent = (recentRows ?? [])
          .filter((r: { id: string }) => r.id !== notificationId)
          .map((r: { type: string; data: Record<string, unknown> | null; email_sent_at: string | null }) => ({
            key: messageConversationKey(r.type, r.data),
            emailSentAt: r.email_sent_at,
          }));
      }
    }

    const emailPlan = planEmail({
      insertedHere: false,
      row: settings,
      category: notification.category,
      type: notification.type,
      priority,
      conversationKey,
      recent,
      now: new Date(),
    });
    if (!emailPlan.send && emailPlan.reason === 'throttled') {
      console.log('Email throttled for conversation', { key: conversationKey, notification_id: notificationId });
    }
    const shouldSendEmail = emailPlan.send;

    if (shouldSendEmail && resendApiKey) {
      // Get tenant info for email including branding and notification_email
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name, owner_email, notification_email, logo_url, primary_color')
        .eq('id', notification.tenant_id)
        .single();

      // Use notification_email if set, otherwise fallback to owner_email
      const tenantEmail = tenant?.notification_email || tenant?.owner_email;
      if (tenantEmail) {
        const resend = new Resend(resendApiKey);

        const recipients = [tenantEmail];
        if (settings?.email_recipients?.length) {
          recipients.push(...settings.email_recipients);
        }

        const tenantName = tenant?.name || 'SellQo';
        const emailSubject = `${prioritySubjects[priority]}${notification.title} — ${tenantName}`;

        // Convert relative action_url (e.g. "/admin/orders/abc") to absolute URL for email links.
        // In-app navigation uses relative paths, but email clients need absolute URLs.
        const ADMIN_BASE_URL = (Deno.env.get('ADMIN_BASE_URL') || 'https://sellqo.app').replace(/\/$/, '');
        // NOTIF-DEEPLINK-1: het pad uit het gedeelde register (type + data), zoals
        // de bel en de pushmelding. Een volledige URL van de aanroeper blijft staan.
        const rawActionUrl = notification.action_url && /^https?:\/\//i.test(notification.action_url)
          ? notification.action_url
          : notificationRoute(notification);
        const fullActionUrl = rawActionUrl
          ? (/^https?:\/\//i.test(rawActionUrl)
              ? rawActionUrl
              : `${ADMIN_BASE_URL}${rawActionUrl.startsWith('/') ? '' : '/'}${rawActionUrl}`)
          : null;

        const priorityBanner =
          priority === 'urgent'
            ? `<div style="background-color:#fee2e2;color:#dc2626;padding:12px 16px;border-radius:6px;margin:0 0 16px;font-weight:600;">⚠️ Urgente melding — directe aandacht vereist</div>`
            : priority === 'high'
              ? `<div style="background-color:#ffedd5;color:#ea580c;padding:12px 16px;border-radius:6px;margin:0 0 16px;font-weight:600;">Hoge prioriteit</div>`
              : '';

        const introHtml = `
          ${priorityBanner}
          <p style="margin:0 0 12px;font-size:13px;color:#5b6b7d;">Melding voor <strong>${tenantName}</strong></p>
          <p style="margin:0;">${notification.message}</p>
        `;

        const htmlContent = renderSellqoEmail({
          preheader: `${notification.title} — ${tenantName}`,
          heading: notification.title,
          intro: introHtml,
          cta: fullActionUrl ? { label: 'Bekijk details', url: fullActionUrl } : undefined,
          footerNote: `Je ontvangt deze e-mail omdat e-mailnotificaties voor ${notification.category} aanstaan.`,
        });
        const textContent = htmlToPlainText(htmlContent);

        try {
          const emailResponse = await resend.emails.send({
            from: EMAIL_SENDERS.notifications.from,
            reply_to: EMAIL_SENDERS.notifications.replyTo,
            to: recipients,
            subject: emailSubject,
            html: htmlContent,
            text: textContent,
          });

          console.log('Email sent:', emailResponse);

          // Update notification with email sent timestamp
          await supabase
            .from('notifications')
            .update({ email_sent_at: new Date().toISOString() })
            .eq('id', notificationId);
        } catch (emailError) {
          console.error('Error sending email:', emailError);
          // Don't throw - notification was still created successfully
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notification_id: notificationId,
        email_sent: shouldSendEmail 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in create-notification:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
