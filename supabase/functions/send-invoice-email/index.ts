import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-INVOICE-EMAIL] ${step}${detailsStr}`);
};

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting invoice email send");

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const resend = new Resend(resendApiKey);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      throw new Error("invoice_id is required");
    }

    logStep("Fetching invoice", { invoice_id });

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error(`Invoice not found: ${invoiceError?.message}`);
    }

    // Fetch tenant
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("*")
      .eq("id", invoice.tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Tenant not found: ${tenantError?.message}`);
    }

    // Fetch customer
    let customer = null;
    if (invoice.customer_id) {
      const { data: customerData } = await supabaseClient
        .from("customers")
        .select("*")
        .eq("id", invoice.customer_id)
        .single();
      customer = customerData;
    }

    // Fetch order for customer email if no customer
    if (!customer && invoice.order_id) {
      const { data: order } = await supabaseClient
        .from("orders")
        .select("customer_email, customer_name")
        .eq("id", invoice.order_id)
        .single();
      
      if (order) {
        customer = {
          email: order.customer_email,
          first_name: order.customer_name?.split(' ')[0] || '',
          last_name: order.customer_name?.split(' ').slice(1).join(' ') || '',
        };
      }
    }

    if (!customer?.email) {
      throw new Error("Customer email not found");
    }

    const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Klant';
    const invoiceFormat = tenant.invoice_format || 'pdf';
    const currency = tenant.currency || 'EUR';

    // Download PDF/UBL and prepare as email attachments
    const emailAttachments: { filename: string; content: string }[] = [];

    if (invoice.pdf_url) {
      try {
        logStep("Downloading PDF for attachment", { url: invoice.pdf_url });
        const pdfResponse = await fetch(invoice.pdf_url);
        if (pdfResponse.ok) {
          const pdfBuffer = await pdfResponse.arrayBuffer();
          emailAttachments.push({
            filename: `${invoice.invoice_number}.pdf`,
            content: arrayBufferToBase64(pdfBuffer),
          });
          logStep("PDF attachment ready", { size: pdfBuffer.byteLength });
        } else {
          logStep("WARNING: Could not download PDF", { status: pdfResponse.status });
        }
      } catch (pdfErr) {
        logStep("WARNING: PDF download failed", { error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr) });
      }
    }

    // Always attach UBL XML if available — required for Odoo / Peppol e-invoice digitalization
    if (invoice.ubl_url) {
      try {
        logStep("Downloading UBL for attachment", { url: invoice.ubl_url });
        const ublResponse = await fetch(invoice.ubl_url);
        if (ublResponse.ok) {
          const ublBuffer = await ublResponse.arrayBuffer();
          emailAttachments.push({
            filename: `${invoice.invoice_number}.xml`,
            content: arrayBufferToBase64(ublBuffer),
          });
          logStep("UBL attachment ready", { size: ublBuffer.byteLength });
        }
      } catch (ublErr) {
        logStep("WARNING: UBL download failed", { error: ublErr instanceof Error ? ublErr.message : String(ublErr) });
      }
    }

    // Build attachments info for email body (download links)
    const attachmentsInfo: string[] = [];
    if (invoice.pdf_url && (invoiceFormat === 'pdf' || invoiceFormat === 'both')) {
      attachmentsInfo.push(`<a href="${invoice.pdf_url}" style="color: #3b82f6;">Download factuur (PDF)</a>`);
    }
    if (invoice.ubl_url) {
      attachmentsInfo.push(`<a href="${invoice.ubl_url}" style="color: #3b82f6;">Download factuur (UBL/XML)</a>`);
    }

    // Use custom email subject/body or defaults
    const emailSubject = tenant.invoice_email_subject || 
      `Factuur ${invoice.invoice_number} van ${tenant.name}`;
    
    const customBody = tenant.invoice_email_body || '';

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: ${tenant.primary_color || '#3b82f6'}; padding: 30px; text-align: center;">
              ${tenant.logo_url ? 
                `<img src="${tenant.logo_url}" alt="${tenant.name}" style="max-height: 50px; margin-bottom: 10px;">` : 
                `<h1 style="color: #ffffff; margin: 0; font-size: 24px;">${tenant.name}</h1>`
              }
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px;">
                Factuur ${invoice.invoice_number}
              </h2>
              
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px;">
                Beste ${customerName},
              </p>
              
              ${customBody ? `<p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px;">${customBody}</p>` : `
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px;">
                Bedankt voor je bestelling! Hierbij ontvang je de factuur voor je aankoop.
              </p>
              `}

              <!-- Invoice Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; padding: 5px 0;">Factuurnummer:</td>
                        <td style="color: #1f2937; text-align: right; padding: 5px 0;"><strong>${invoice.invoice_number}</strong></td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; padding: 5px 0;">Totaalbedrag:</td>
                        <td style="color: #1f2937; text-align: right; padding: 5px 0;"><strong>${formatCurrency(Number(invoice.total), currency)}</strong></td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; padding: 5px 0;">Status:</td>
                        <td style="color: #059669; text-align: right; padding: 5px 0;"><strong>Betaald</strong></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Download Links -->
              <div style="text-align: center; margin: 30px 0;">
                ${attachmentsInfo.join('<br style="margin: 10px 0;">')}
              </div>

              <p style="color: #4b5563; line-height: 1.6; margin: 20px 0 0;">
                Heb je vragen over deze factuur? Neem dan gerust contact met ons op.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                ${tenant.name}
                ${tenant.address ? ` | ${tenant.address}` : ''}
                ${tenant.city ? `, ${tenant.city}` : ''}
              </p>
              <p style="color: #6b7280; font-size: 12px; margin: 5px 0 0;">
                ${tenant.kvk_number ? `KvK: ${tenant.kvk_number}` : ''}
                ${tenant.btw_number ? ` | BTW: ${tenant.btw_number}` : ''}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Build recipients list
    const toEmails = [customer.email];
    const ccEmails = tenant.invoice_cc_email ? [tenant.invoice_cc_email] : undefined;
    const bccEmails = tenant.invoice_bcc_email ? [tenant.invoice_bcc_email] : undefined;

    // 1. Primaire e-mail naar klant (met PDF bijlage)
    logStep("Sending primary email", { to: customer.email, attachments: emailAttachments.length });

    const emailResponse = await resend.emails.send({
      from: `${tenant.name} <noreply@sellqo.app>`,
      to: toEmails,
      subject: emailSubject,
      html: emailHtml,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
    });

    logStep("Primary email sent", { response: emailResponse });

    // 2. Aparte kopie naar CC/BCC adressen
    const copyRecipients = [
      ...(ccEmails || []),
      ...(bccEmails || []),
    ];

    if (copyRecipients.length > 0) {
      try {
        logStep("Sending copy email", { to: copyRecipients });
        const copyResponse = await resend.emails.send({
          from: `${tenant.name} <noreply@sellqo.app>`,
          to: copyRecipients,
          subject: `[Kopie] ${emailSubject}`,
          html: emailHtml,
          attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
        });
        logStep("Copy email sent", { response: copyResponse });
      } catch (copyError) {
        logStep("WARNING: Copy email failed (non-blocking)", { error: copyError instanceof Error ? copyError.message : String(copyError) });
      }
    }

    // Update invoice status to sent
    await supabaseClient
      .from("invoices")
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq("id", invoice_id);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Invoice email sent successfully",
      email_id: emailResponse?.data?.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
