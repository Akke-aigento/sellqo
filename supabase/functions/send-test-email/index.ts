import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { tenantMarketingSender } from "../_shared/emailSenders.ts";
import { requireBillingState } from "../_shared/billingGuard.ts";
import { buildUnsubscribeUrl, buildPreferencesUrl } from "../_shared/marketingToken.ts";
import { getTenantBrand, renderTenantEmail, type TenantLocale } from "../_shared/tenantEmail.ts";
import { t } from "../_shared/tenantEmailI18n.ts";
import { extractEmailBody, buildVariableMap, applyVariables } from "../_shared/emailContent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendTestEmailRequest {
  tenantId: string;
  toEmail: string;
  subject: string;
  htmlContent: string;
  /** Genegeerd sinds MAIL-SENDER-1; bleef staan zodat oude clients niet falen. */
  sender?: string;
  previewData?: {
    customer_name?: string;
    customer_email?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Resend API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenantId, toEmail, subject, htmlContent, previewData, sender }: SendTestEmailRequest = await req.json();

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ["tenant_admin", "staff", "marketing"]);

    if (!tenantId || !toEmail || !subject || !htmlContent) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // BILLING-ENFORCE-1 / MAIL-1a: zoals send-campaign-batch — geen mail terwijl
    // er een betaling openstaat.
    await requireBillingState(supabase, auth, tenantId, "marketing");

    // MAIL-1a: dezelfde render als een echte campagne (send-campaign-batch), zodat
    // de testmail er exact uitziet zoals bij de klant: brand-wrapper, variabelen,
    // ondertekende uitschrijflink en List-Unsubscribe-headers.
    // MAIL-CONTACT-1: `email`, `street` en `vat_number` bestaan niet op tenants.
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("name, slug, inbound_email_prefix, support_email, phone, custom_domain, iban, address, city, postal_code, country, language")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError) {
      console.error("[send-test-email] tenant select failed", { tenantId, error: tenantError });
      return new Response(JSON.stringify({ error: "Could not load tenant" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const brand = await getTenantBrand(supabase, tenantId);

    // MAIL-SENDER-1: een test gaat altijd uit als de winkel zelf. De `sender`-key
    // van de client wordt genegeerd. MAIL-1a: marketing-afzender, zonder
    // terugval op het platformadres.
    void sender;
    const resolvedSender = tenantMarketingSender(brand.senderSource);
    if (!resolvedSender) {
      return new Response(JSON.stringify({
        error: "Je winkel heeft nog geen geldig mailadres (prefix). Stel dit in bij Instellingen.",
        code: "NO_SENDER",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const locale = brand.defaultLocale as TenantLocale;
    const customerEmail = (previewData?.customer_email || toEmail).trim();
    const previewName = (previewData?.customer_name || "").trim();
    // De links ondertekenen het testadres zelf (toEmail), niet het preview-adres:
    // een klik op "uitschrijven" in een testmail mag nooit een echte klant raken.
    const [unsubscribeUrl, preferencesUrl] = await Promise.all([
      buildUnsubscribeUrl(tenantId, toEmail),
      buildPreferencesUrl(tenantId, toEmail),
    ]);

    const vars = buildVariableMap(
      { email: customerEmail, first_name: previewName || "Test Klant" },
      tenant,
      { subject },
      unsubscribeUrl,
      {
        tenantName: brand.tenantName,
        logoUrl: brand.emailLogoUrl ?? undefined,
        primaryColor: brand.primaryColor,
        accentColor: brand.accentColor,
        headingFont: brand.headingFont,
      },
      locale,
    );
    // Volledige naam zoals ingevuld in de preview (buildVariableMap kent enkel voor/achternaam).
    if (previewName) vars.customer_name = previewName;
    // Oudere sjablonen gebruiken nog {{preferences_url}}.
    vars.preferences_url = preferencesUrl;

    const rawBody = extractEmailBody(htmlContent);
    const bodyHtml = applyVariables(rawBody, vars);
    const renderedSubject = applyVariables(subject, vars);

    // Testbanner bovenaan de inhoud. Klanten zien hem niet.
    const testBanner = `<div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 12px 20px; text-align: center; font-family: sans-serif; font-size: 14px; color: #92400e; margin-bottom: 20px;"><strong>TESTMAIL</strong> - Dit is een voorbeeld. Je klanten zien deze banner niet.</div>`;

    const { html: wrappedHtml, text: wrappedText } = renderTenantEmail({
      tenantBrand: brand,
      locale,
      preheader: renderedSubject,
      heading: renderedSubject,
      intro: testBanner + bodyHtml,
      unsubscribeUrl,
      poweredByLabel: t(locale, "campaign.poweredBy"),
    });

    // Send the test email
    const emailResponse = await resend.emails.send({
      from: resolvedSender.from,
      reply_to: resolvedSender.replyTo,
      to: [toEmail],
      subject: `[TEST] ${renderedSubject}`,
      html: wrappedHtml,
      text: wrappedText,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    if (emailResponse.error) {
      throw new Error(emailResponse.error.message);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Test email verzonden naar ${toEmail}`,
      emailId: emailResponse.data?.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send test email error:", error);
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to send test email" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
