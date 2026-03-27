import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

// Default email settings matching NOTIFICATION_CONFIG in src/types/notification.ts
const DEFAULT_EMAIL_ENABLED: Record<string, boolean> = {
  // Orders
  'order_new': true,
  'order_paid': false,
  'order_payment_failed': true,
  'order_cancelled': false,
  'order_refund_requested': true,
  'order_shipped': false,
  'order_delivered': false,
  'order_high_value': true,
  'marketplace_order_new': true,
  // Invoices
  'invoice_created': false,
  'invoice_sent': false,
  'invoice_paid': false,
  'invoice_overdue': true,
  'invoice_overdue_7days': true,
  'invoice_overdue_30days': true,
  'invoice_reminder_sent': false,
  'peppol_invoice_accepted': false,
  'peppol_invoice_rejected': true,
  // Payments
  'payment_received': false,
  'payout_available': true,
  'payout_completed': false,
  'stripe_account_issue': true,
  'chargeback_received': true,
  // Customers
  'customer_new': false,
  'customer_first_order': false,
  'customer_vip_status': false,
  'customer_message_received': true,
  'newsletter_signup': false,
  // Products
  'stock_low': true,
  'stock_critical': true,
  'stock_out': true,
  'stock_replenished': false,
  'product_bestseller': false,
  // Quotes
  'quote_accepted': true,
  'quote_expiring_soon': true,
  // Subscriptions
  'subscription_new': true,
  'subscription_cancelled': true,
  'subscription_payment_failed': true,
  'subscription_expiring': true,
  // Marketing
  'campaign_bounce_alert': true,
  'ai_credits_low': true,
  'ai_credits_empty': true,
  // Team
  'login_new_device': true,
  'login_failed_attempts': true,
  // System
  'platform_gift': true,
  'usage_limit_80': true,
  'usage_limit_reached': true,
  'integration_error': true,
  // Integrations
  'shopify_request_approved': true,
  'shopify_request_completed': true,
  'shopify_request_rejected': true,
};

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
    // Only send email when called via DB trigger (skip_in_app=true)
    // This prevents duplicate emails: the DB trigger path is the single source of truth for emails
    if (!skipInApp) {
      console.log('Direct call (skip_in_app=false) - skipping email, DB trigger will handle it');
      return new Response(
        JSON.stringify({ 
          success: true, 
          notification_id: notificationId,
          email_sent: false,
          reason: 'email_delegated_to_trigger'
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { data: settings } = await supabase
      .from('tenant_notification_settings')
      .select('email_enabled, email_recipients')
      .eq('tenant_id', notification.tenant_id)
      .eq('category', notification.category)
      .eq('notification_type', notification.type)
      .single();

    // Default to sending email for high/urgent if no settings exist
    const shouldSendEmail = settings?.email_enabled 
      ?? DEFAULT_EMAIL_ENABLED[notification.type] 
      ?? (priority === 'urgent' || priority === 'high');

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

        const emailSubject = `${prioritySubjects[priority]}${notification.title}`;
        const primaryColor = tenant?.primary_color || '#18181b';
        const tenantName = tenant?.name || 'Sellqo';
        const logoUrl = tenant?.logo_url;

        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <tr>
                <td>
                  <!-- Header with logo/branding -->
                  <div style="background-color: ${primaryColor}; border-radius: 8px 8px 0 0; padding: 24px; text-align: center;">
                    ${logoUrl 
                      ? `<img src="${logoUrl}" alt="${tenantName}" style="max-height: 48px; max-width: 200px;">`
                      : `<span style="color: white; font-size: 24px; font-weight: 600;">${tenantName}</span>`
                    }
                  </div>
                  
                  <div style="background-color: white; border-radius: 0 0 8px 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    ${priority === 'urgent' ? '<div style="background-color: #fee2e2; color: #dc2626; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px; font-weight: 500;">⚠️ Dit is een urgente melding die directe aandacht vereist</div>' : ''}
                    ${priority === 'high' ? '<div style="background-color: #ffedd5; color: #ea580c; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px; font-weight: 500;">Deze melding heeft hoge prioriteit</div>' : ''}
                    
                    <h1 style="color: #18181b; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">
                      ${notification.title}
                    </h1>
                    
                    <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                      ${notification.message}
                    </p>
                    
                    ${notification.action_url ? `
                      <a href="${notification.action_url}" style="display: inline-block; background-color: ${primaryColor}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                        Bekijk details →
                      </a>
                    ` : ''}
                    
                    <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0 24px 0;">
                    
                    <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
                      Je ontvangt deze email omdat je notificaties hebt ingeschakeld voor ${notification.category}.
                      <br>
                      Met vriendelijke groet,<br>
                      <strong>${tenantName}</strong>
                    </p>
                  </div>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

        try {
          const emailResponse = await resend.emails.send({
            from: `${tenant.name || 'Sellqo'} <noreply@sellqo.app>`,
            to: recipients,
            subject: emailSubject,
            html: htmlContent,
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
