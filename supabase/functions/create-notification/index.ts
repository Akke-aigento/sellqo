import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { renderSellqoEmail, htmlToPlainText } from "../_shared/sellqoEmail.ts";

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

    const notification: NotificationRequest = await req.json();
    await authenticateRequest(req, notification.tenant_id);

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
        console.error('Error creating notification:', notificationError);
        throw notificationError;
      }

      notificationId = notificationData.id;
      console.log('Notification created:', notificationId);
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

    // Default to sending email for high/urgent if no settings exist
    const shouldSendEmail = settings?.email_enabled ?? (priority === 'urgent' || priority === 'high');

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
        const rawActionUrl = notification.action_url;
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
            from: "SellQo <noreply@sellqo.app>",
            reply_to: "support@sellqo.app",
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
