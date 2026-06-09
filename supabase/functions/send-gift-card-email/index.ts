import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { EMAIL_SENDERS } from "../_shared/emailSenders.ts";
import {
  getTenantBrand,
  renderTenantEmail,
  renderGiftCardVisual,
} from "../_shared/tenantEmail.ts";
import { t } from "../_shared/tenantEmailI18n.ts";

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
    await authenticateRequest(req);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { gift_card_id, recipient_email_override }: SendGiftCardEmailRequest = await req.json();

    // Fetch gift card with design
    const { data: giftCard, error: giftCardError } = await supabaseClient
      .from("gift_cards")
      .select(`
        *,
        design:gift_card_designs(*)
      `)
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

    const brand = await getTenantBrand(supabaseClient, giftCard.tenant_id);
    const locale = brand.defaultLocale;
    const fromName = brand.tenantName;
    const websiteUrl = (tenant.website_url as string) || brand.websiteUrl || "https://sellqo.app";
    const recipientName = giftCard.recipient_name || "ontvanger";
    const personalMessage = giftCard.recipient_name ? giftCard.personal_message : "";
    const expiresAt = giftCard.expires_at
      ? new Date(giftCard.expires_at).toLocaleDateString(locale === "nl" ? "nl-NL" : "en-US", { day: "numeric", month: "long", year: "numeric" })
      : undefined;

    const personalBlock = personalMessage
      ? `<div style="background:#f9fafb;border-left:4px solid ${brand.primaryColor};padding:16px;margin:16px 0;border-radius:0 8px 8px 0;font-style:italic;color:#374151;">${String(personalMessage).replace(/[<>]/g, "")}</div>`
      : "";

    const content = `
      ${personalBlock}
      ${renderGiftCardVisual({
        code: giftCard.code,
        amount: Number(giftCard.current_balance) || 0,
        currency: giftCard.currency || "EUR",
        locale,
        expiresAt: expiresAt ? `${t(locale, "giftCard.expires")}: ${expiresAt}` : undefined,
        brandColor: brand.primaryColor,
      })}
      <p style="margin:16px 0 0;color:#6b7280;font-size:14px;text-align:center;">${t(locale, "giftCard.instructions")}</p>
    `;

    const { html: emailHtml, text } = renderTenantEmail({
      tenantBrand: brand,
      locale,
      preheader: t(locale, "giftCard.intro", { tenantName: fromName }),
      heading: t(locale, "giftCard.heading", { recipientName }),
      intro: `<p>${t(locale, "giftCard.intro", { tenantName: fromName })}</p>`,
      content,
      primaryCta: { label: t(locale, "giftCard.cta"), url: websiteUrl },
      poweredByLabel: t(locale, "giftCard.poweredBy"),
    });

    const gcSender = EMAIL_SENDERS.giftCards(fromName, tenant.owner_email);
    // Send email
    const emailResponse = await resend.emails.send({
      from: gcSender.from,
      reply_to: gcSender.replyTo,
      to: [recipientEmail],
      subject: t(locale, "giftCard.subject", { tenantName: fromName }),
      html: emailHtml,
      text,
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
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
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