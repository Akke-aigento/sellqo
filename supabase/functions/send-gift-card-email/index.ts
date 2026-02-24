import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendGiftCardEmailRequest {
  gift_card_id: string;
  recipient_email_override?: string;
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

    const { gift_card_id, recipient_email_override }: SendGiftCardEmailRequest = await req.json();

    // Fetch gift card
    const { data: giftCard, error: giftCardError } = await supabaseClient
      .from("gift_cards")
      .select("*")
      .eq("id", gift_card_id)
      .single();

    if (giftCardError || !giftCard) {
      throw new Error("Gift card not found");
    }

    const recipientEmail = recipient_email_override || giftCard.recipient_email;
    if (!recipientEmail) {
      throw new Error("No recipient email specified");
    }

    // Fetch tenant info
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("name, owner_email, logo_url, primary_color, website_url")
      .eq("id", giftCard.tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    const fromName = tenant.name || "Sellqo";
    const primaryColor = tenant.primary_color || "#2563eb";
    const websiteUrl = tenant.website_url || "#";
    const recipientName = giftCard.recipient_name || "ontvanger";
    const personalMessage = giftCard.personal_message;
    const templateId = giftCard.design_id || "elegant";
    const expiresAt = giftCard.expires_at 
      ? new Date(giftCard.expires_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

    // Template styles
    const templateStyles: Record<string, { bg: string; text: string; accent: string; cardBg: string }> = {
      elegant: { bg: '#1a1a2e', text: '#fef3c7', accent: '#fbbf24', cardBg: '#1e1e3a' },
      modern: { bg: '#ffffff', text: '#1e293b', accent: primaryColor, cardBg: '#f8fafc' },
      festive: { bg: '#dc2626', text: '#ffffff', accent: '#fef08a', cardBg: '#ef4444' },
      botanical: { bg: '#ecfdf5', text: '#064e3b', accent: '#059669', cardBg: '#f0fdf4' },
      minimal: { bg: '#ffffff', text: '#111827', accent: '#111827', cardBg: '#ffffff' },
      gradient: { bg: primaryColor, text: '#ffffff', accent: '#e9d5ff', cardBg: primaryColor },
    };
    const style = templateStyles[templateId] || templateStyles.elegant;

    // Build beautiful HTML email
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Je hebt een cadeaukaart ontvangen!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <tr>
            <td style="background: ${templateId === 'gradient' ? `linear-gradient(135deg, ${style.bg}, ${style.cardBg})` : style.bg}; padding: 48px 32px; text-align: center;">
              <p style="color: ${style.text}; opacity: 0.7; font-size: 12px; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 4px 0;">Cadeaukaart</p>
              <h1 style="color: ${style.text}; font-size: 28px; margin: 0 0 16px 0;">${fromName}</h1>
              <div style="display: inline-block; color: ${style.accent}; font-size: 42px; font-weight: 700; margin: 0;">
                €${Number(giftCard.current_balance).toFixed(2)}
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 8px 0; color: #111827; font-size: 24px; text-align: center;">
                Gefeliciteerd, ${recipientName}!
              </h2>
              <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 16px; text-align: center;">
                Je hebt een cadeaukaart ontvangen van ${fromName}
              </p>
              
              ${personalMessage ? `
              <div style="background-color: #f9fafb; border-left: 4px solid ${primaryColor}; padding: 16px; margin: 0 0 24px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #374151; font-size: 16px; font-style: italic;">
                  "${personalMessage}"
                </p>
              </div>
              ` : ''}
              
              <!-- Gift Card Code Box -->
              <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                  Jouw code
                </p>
                <p style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #111827; font-family: 'Courier New', monospace; letter-spacing: 2px;">
                  ${giftCard.code}
                </p>
                <div style="display: inline-block; background-color: ${primaryColor}; color: #ffffff; padding: 8px 24px; border-radius: 9999px; font-size: 20px; font-weight: 600;">
                  €${Number(giftCard.current_balance).toFixed(2)}
                </div>
              </div>
              
              ${expiresAt ? `
              <p style="margin: 0 0 24px 0; color: #9ca3af; font-size: 14px; text-align: center;">
                ⏰ Geldig tot: ${expiresAt}
              </p>
              ` : ''}
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${websiteUrl}" style="display: inline-block; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Bekijk de webshop
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; text-align: center;">
                Voer de code in bij het afrekenen om je tegoed te gebruiken.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                Deze email is verzonden door ${fromName}
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

    // Send email
    const emailResponse = await resend.emails.send({
      from: `${fromName} <noreply@sellqo.app>`,
      to: [recipientEmail],
      reply_to: tenant.owner_email || undefined,
      subject: `🎁 Je hebt een cadeaukaart ontvangen van ${fromName}!`,
      html: emailHtml,
    });

    if (emailResponse.error) {
      throw new Error(`Failed to send email: ${emailResponse.error.message}`);
    }

    // Update gift card with email sent timestamp
    const isResend = !!giftCard.email_sent_at;
    await supabaseClient
      .from("gift_cards")
      .update({
        email_sent_at: new Date().toISOString(),
        email_resent_count: isResend ? (giftCard.email_resent_count || 0) + 1 : 0,
      })
      .eq("id", gift_card_id);

    console.log("Gift card email sent successfully:", emailResponse.data?.id);

    return new Response(
      JSON.stringify({
        success: true,
        resend_id: emailResponse.data?.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in send-gift-card-email:", error);
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