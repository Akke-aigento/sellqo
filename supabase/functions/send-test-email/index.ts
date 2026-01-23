import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendTestEmailRequest {
  tenantId: string;
  toEmail: string;
  subject: string;
  htmlContent: string;
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

    const { tenantId, toEmail, subject, htmlContent, previewData }: SendTestEmailRequest = await req.json();

    if (!tenantId || !toEmail || !subject || !htmlContent) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, email, street, city, postal_code, country, vat_number, kvk_number")
      .eq("id", tenantId)
      .single();

    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build company address
    const companyAddress = [
      tenant.street,
      `${tenant.postal_code || ""} ${tenant.city || ""}`.trim(),
      tenant.country,
    ].filter(Boolean).join(", ");

    // Replace template variables
    const customerName = previewData?.customer_name || "Test Klant";
    const customerEmail = previewData?.customer_email || toEmail;
    
    let processedHtml = htmlContent
      .replace(/\{\{customer_name\}\}/g, customerName)
      .replace(/\{\{customer_email\}\}/g, customerEmail)
      .replace(/\{\{company_name\}\}/g, tenant.name || "")
      .replace(/\{\{company_address\}\}/g, companyAddress)
      .replace(/\{\{kvk_number\}\}/g, tenant.kvk_number || "")
      .replace(/\{\{vat_number\}\}/g, tenant.vat_number || "")
      .replace(/\{\{unsubscribe_url\}\}/g, `${supabaseUrl}/functions/v1/unsubscribe?email=${encodeURIComponent(customerEmail)}&tenant=${tenantId}`)
      .replace(/\{\{preferences_url\}\}/g, `${supabaseUrl}/functions/v1/email-preferences?email=${encodeURIComponent(customerEmail)}&tenant=${tenantId}`);

    const processedSubject = subject
      .replace(/\{\{customer_name\}\}/g, customerName)
      .replace(/\{\{company_name\}\}/g, tenant.name || "");

    // Add test email banner
    const testBanner = `
      <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 12px 20px; text-align: center; font-family: sans-serif; font-size: 14px; color: #92400e; margin-bottom: 20px;">
        🧪 <strong>TEST EMAIL</strong> - Dit is een voorbeeld. Je klanten zien deze banner niet.
      </div>
    `;
    
    // Insert banner after <body> tag or at start
    if (processedHtml.includes("<body")) {
      processedHtml = processedHtml.replace(/(<body[^>]*>)/i, `$1${testBanner}`);
    } else {
      processedHtml = testBanner + processedHtml;
    }

    // Send the test email
    const emailResponse = await resend.emails.send({
      from: tenant.email ? `${tenant.name} <${tenant.email}>` : "noreply@resend.dev",
      to: [toEmail],
      subject: `[TEST] ${processedSubject}`,
      html: processedHtml,
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
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to send test email" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
