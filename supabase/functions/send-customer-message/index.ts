import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendMessageRequest {
  tenant_id: string;
  customer_email: string;
  customer_name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  context_type: 'order' | 'quote' | 'general';
  order_id?: string;
  quote_id?: string;
  customer_id?: string;
  context_data?: Record<string, unknown>;
  // Email threading headers
  in_reply_to?: string;
  references?: string;
  // CC/BCC
  cc?: string[];
  bcc?: string[];
  // Attachments
  attachments?: { filename: string; path: string }[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      tenant_id,
      customer_email,
      customer_name,
      subject,
      body_html,
      body_text,
      context_type,
      order_id,
      quote_id,
      customer_id,
      context_data = {},
      in_reply_to,
      references,
      cc,
      bcc,
      attachments,
    }: SendMessageRequest = await req.json();

    // Fetch tenant info for branding and reply-to
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("name, owner_email, logo_url, primary_color, address, city, postal_code, country")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    const replyToEmail = tenant.owner_email || "noreply@sellqo.app";
    const fromName = tenant.name || "Sellqo";
    const primaryColor = tenant.primary_color || "#2563eb";

    // Build professional HTML email template
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${primaryColor}; padding: 24px 32px;">
              ${tenant.logo_url 
                ? `<img src="${tenant.logo_url}" alt="${fromName}" style="max-height: 40px; max-width: 200px;">` 
                : `<span style="color: #ffffff; font-size: 24px; font-weight: 600;">${fromName}</span>`
              }
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px;">
                Beste ${customer_name || 'klant'},
              </p>
              
              <div style="color: #374151; font-size: 16px; line-height: 1.6;">
                ${body_html}
              </div>
              
              ${context_type === 'order' && context_data?.order_number ? `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 24px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                      📦 Betreft bestelling: <strong style="color: #111827;">${context_data.order_number}</strong>
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              ${context_type === 'quote' && context_data?.quote_number ? `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 24px; background-color: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                      📄 Betreft offerte: <strong style="color: #111827;">${context_data.quote_number}</strong>
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              <p style="margin: 32px 0 0 0; color: #374151; font-size: 16px;">
                Met vriendelijke groet,<br>
                <strong>${fromName}</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
                ${tenant.address ? `${tenant.address}, ` : ''}${tenant.postal_code || ''} ${tenant.city || ''}${tenant.country ? `, ${tenant.country}` : ''}
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Je kunt direct antwoorden op deze email. Je antwoord gaat naar ${replyToEmail}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    // Create message record first
    const { data: message, error: insertError } = await supabaseClient
      .from("customer_messages")
      .insert({
        tenant_id,
        customer_id,
        order_id,
        quote_id,
        direction: 'outbound',
        subject,
        body_html,
        body_text: body_text || body_html.replace(/<[^>]*>/g, ''),
        from_email: `${fromName} <noreply@sellqo.app>`,
        to_email: customer_email,
        reply_to_email: replyToEmail,
        delivery_status: 'sending',
        context_type,
        context_data,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create message record: ${insertError.message}`);
    }

    // Build email headers for threading
    const emailHeaders: Record<string, string> = {};
    if (in_reply_to) {
      emailHeaders['In-Reply-To'] = in_reply_to;
    }
    if (references) {
      emailHeaders['References'] = references;
    }

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: `${fromName} <noreply@sellqo.app>`,
      to: [customer_email],
      reply_to: replyToEmail,
      subject,
      html: emailHtml,
      text: body_text || body_html.replace(/<[^>]*>/g, ''),
      ...(Object.keys(emailHeaders).length > 0 && { headers: emailHeaders }),
      ...(cc && cc.length > 0 && { cc }),
      ...(bcc && bcc.length > 0 && { bcc }),
      ...(attachments && attachments.length > 0 && { attachments }),
    });

    if (emailResponse.error) {
      // Update message status to failed
      await supabaseClient
        .from("customer_messages")
        .update({
          delivery_status: 'failed',
          error_message: emailResponse.error.message,
        })
        .eq("id", message.id);

      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    // Update message with resend ID and sent status
    await supabaseClient
      .from("customer_messages")
      .update({
        resend_id: emailResponse.data?.id,
        delivery_status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq("id", message.id);

    console.log("Customer message sent successfully:", emailResponse.data?.id);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: message.id,
        resend_id: emailResponse.data?.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-customer-message:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
