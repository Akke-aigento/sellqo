import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { ownedCustomerIdOrNull } from "../_shared/customerGuard.ts";
import { tenantSender } from "../_shared/emailSenders.ts";
import { getTenantBrand } from "../_shared/tenantEmail.ts";
import { buildCustomerMessageEmail, customerMessageLayout } from "../_shared/customerMessageEmail.ts";

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
  // MAIL-REPLY-FORMAT-1: 'inbox' = geen kop, aanhef of groet; weg = de huidige vorm.
  layout?: string;
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
      layout,
    }: SendMessageRequest = await req.json();

    const auth = await authenticateRequest(req, tenant_id);
    // Fase 2 — Batch 2B2b: klantenservice context (tenant_admin/staff/accountant)
    requireRole(auth, tenant_id, ['tenant_admin', 'staff', 'accountant']);

    // INBOX-REPLY-1: alleen een echte klant van deze winkel koppelen; een
    // afgeleide gesprekssleutel of een id uit een andere winkel wordt null.
    const safeCustomerId = await ownedCustomerIdOrNull(supabaseClient, tenant_id, customer_id, "send-customer-message");

    // Fetch tenant info for branding and reply-to
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("name, owner_email, logo_url, primary_color, address, city, postal_code, country")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    const brand = await getTenantBrand(supabaseClient, tenant_id);
    const replyToEmail = brand.supportEmail;
    const csSender = tenantSender(brand.senderSource);

    // MAIL-REPLY-FORMAT-1: opbouw verhuisd naar _shared/customerMessageEmail.ts;
    // zonder `layout` exact de vorige mail.
    const { html: emailHtml, text: emailText } = buildCustomerMessageEmail({
      brand,
      subject,
      bodyHtml: body_html,
      customerName: customer_name,
      contextType: context_type,
      contextData: context_data,
      replyToEmail,
      layout: customerMessageLayout(layout),
    });

    // Create message record first
    const { data: message, error: insertError } = await supabaseClient
      .from("customer_messages")
      .insert({
        tenant_id,
        customer_id: safeCustomerId,
        order_id,
        quote_id,
        direction: 'outbound',
        subject,
        body_html,
        body_text: body_text || body_html.replace(/<[^>]*>/g, ''),
        from_email: csSender.from,
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

    // Build email headers for threading and deliverability
    const emailHeaders: Record<string, string> = {};
    if (in_reply_to) {
      emailHeaders['In-Reply-To'] = in_reply_to;
    }
    if (references) {
      emailHeaders['References'] = references;
    }

    // MAIL-SENDER-1: geen List-Unsubscribe meer. Dit is een 1-op-1-bericht van de
    // winkel aan één klant, geen nieuwsbrief; met die header toonde iOS er
    // "mailinglijst / Afmelden" boven. Campagnes en automations houden hem.

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: csSender.from,
      to: [customer_email],
      reply_to: csSender.replyTo,
      subject,
      html: emailHtml,
      text: body_text || emailText,
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
