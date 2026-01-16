import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[SEND-QUOTE-EMAIL] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { quoteId } = await req.json();
    logStep("Request received", { quoteId });

    if (!quoteId) {
      throw new Error("Quote ID is required");
    }

    // Fetch quote with items and customer
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select(`
        *,
        customer:customers(*),
        quote_items(*)
      `)
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      throw new Error(`Quote not found: ${quoteError?.message}`);
    }

    logStep("Quote fetched", { quoteNumber: quote.quote_number });

    // Fetch tenant for branding
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", quote.tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Tenant not found: ${tenantError?.message}`);
    }

    logStep("Tenant fetched", { tenantName: tenant.name });

    if (!quote.customer?.email) {
      throw new Error("Customer email not found");
    }

    const customerName = quote.customer.first_name 
      ? `${quote.customer.first_name} ${quote.customer.last_name || ''}`.trim()
      : 'Geachte klant';

    const validUntilDate = quote.valid_until 
      ? new Date(quote.valid_until).toLocaleDateString('nl-NL', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })
      : null;

    // Build items HTML
    const itemsHtml = quote.quote_items.map((item: any) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${item.product_name}
          ${item.description ? `<br><small style="color: #6b7280;">${item.description}</small>` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${Number(item.unit_price).toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">€${Number(item.total_price).toFixed(2)}</td>
      </tr>
    `).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <tr>
            <td style="padding: 40px 30px; background-color: ${tenant.primary_color || '#3b82f6'};">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">${tenant.name}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 20px;">Offerte ${quote.quote_number}</h2>
              <p style="margin: 0 0 20px 0; color: #374151; line-height: 1.6;">
                Beste ${customerName},
              </p>
              <p style="margin: 0 0 20px 0; color: #374151; line-height: 1.6;">
                Hierbij ontvangt u onze offerte. Hieronder vindt u een overzicht van de producten en/of diensten.
              </p>
              
              ${validUntilDate ? `
                <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">
                  <strong>Geldig tot:</strong> ${validUntilDate}
                </p>
              ` : ''}
              
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Omschrijving</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Aantal</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Prijs</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="padding: 12px; text-align: right; color: #6b7280;">Subtotaal</td>
                    <td style="padding: 12px; text-align: right;">€${Number(quote.subtotal).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td colspan="3" style="padding: 12px; text-align: right; color: #6b7280;">BTW</td>
                    <td style="padding: 12px; text-align: right;">€${Number(quote.tax_amount).toFixed(2)}</td>
                  </tr>
                  ${Number(quote.discount_amount) > 0 ? `
                    <tr>
                      <td colspan="3" style="padding: 12px; text-align: right; color: #059669;">Korting</td>
                      <td style="padding: 12px; text-align: right; color: #059669;">-€${Number(quote.discount_amount).toFixed(2)}</td>
                    </tr>
                  ` : ''}
                  <tr style="background-color: #f9fafb;">
                    <td colspan="3" style="padding: 16px 12px; text-align: right; font-weight: 700; font-size: 16px;">Totaal</td>
                    <td style="padding: 16px 12px; text-align: right; font-weight: 700; font-size: 16px;">€${Number(quote.total).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
              
              ${quote.notes ? `
                <div style="padding: 20px; background-color: #f9fafb; border-radius: 8px; margin-bottom: 30px;">
                  <p style="margin: 0; color: #374151; font-size: 14px;">${quote.notes}</p>
                </div>
              ` : ''}
              
              ${quote.payment_link ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${quote.payment_link}" style="display: inline-block; padding: 16px 32px; background-color: ${tenant.primary_color || '#3b82f6'}; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 16px;">
                    Offerte accepteren & betalen
                  </a>
                </div>
              ` : ''}
              
              <p style="margin: 30px 0 0 0; color: #374151; line-height: 1.6;">
                Met vriendelijke groet,<br>
                <strong>${tenant.name}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f9fafb; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                ${tenant.address ? `${tenant.address}, ` : ''}${tenant.postal_code ? `${tenant.postal_code} ` : ''}${tenant.city || ''}
                ${tenant.phone ? `<br>Tel: ${tenant.phone}` : ''}
                ${tenant.owner_email ? `<br>${tenant.owner_email}` : ''}
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    logStep("Sending email", { to: quote.customer.email });

    // Send email
    const emailResponse = await resend.emails.send({
      from: `${tenant.name} <onboarding@resend.dev>`,
      to: [quote.customer.email],
      subject: `Offerte ${quote.quote_number} van ${tenant.name}`,
      html: emailHtml,
    });

    logStep("Email sent", { emailResponse });

    // Update quote status to 'sent'
    const { error: updateError } = await supabase
      .from("quotes")
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq("id", quoteId);

    if (updateError) {
      console.error("Error updating quote status:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent successfully",
        emailResponse
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error("Error sending quote email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
