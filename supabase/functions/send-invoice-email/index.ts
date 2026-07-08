import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { EMAIL_SENDERS } from "../_shared/emailSenders.ts";
import { getTenantBrand, renderTenantEmail, formatAmount } from "../_shared/tenantEmail.ts";
import { t } from "../_shared/tenantEmailI18n.ts";

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

    const auth = await authenticateRequest(req);

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

    // Batch 2A2b: alleen admin/staff/accountant mogen facturen versturen.
    requireRole(auth, invoice.tenant_id, ["tenant_admin", "staff", "accountant"]);

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

    const brand = await getTenantBrand(supabaseClient, invoice.tenant_id);
    const locale = brand.defaultLocale;

    // Auto-collected invoices (charged via active mandate) must NOT include
    // payment instructions — the charge is already in flight or completed.
    const isAutoCollected =
      invoice.status === 'processing' || invoice.status === 'paid';
    const autoVariant: 'processing' | 'paid' | null = isAutoCollected
      ? (invoice.status === 'paid' ? 'paid' : 'processing')
      : null;

    const emailSubject = isAutoCollected
      ? t(locale, 'invoice.autoCollectSubject', { invoiceNumber: invoice.invoice_number, tenantName: brand.tenantName })
      : (tenant.invoice_email_subject ||
          t(locale, 'invoice.subject', { invoiceNumber: invoice.invoice_number, tenantName: brand.tenantName }));

    // For auto-collected invoices we intentionally IGNORE the tenant's
    // custom invoice_email_body — it typically contains payment terms
    // ("betaal binnen X dagen") which would mislead the customer into
    // paying while the charge is already running.
    const customBody = isAutoCollected
      ? t(locale, 'invoice.autoCollectIntro', { customerName })
      : (tenant.invoice_email_body || t(locale, 'invoice.intro', { customerName }));

    const attachedLine = isAutoCollected
      ? t(locale, autoVariant === 'paid' ? 'invoice.autoCollectPaidNote' : 'invoice.autoCollectProcessingNote')
      : t(locale, 'invoice.attached');

    const summary = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f9fafb;border-radius:8px;margin:20px 0;"><tr><td style="padding:20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr><td style="color:#6b7280;padding:5px 0;">Factuurnummer:</td><td style="color:#1f2937;text-align:right;padding:5px 0;"><strong>${invoice.invoice_number}</strong></td></tr>
        <tr><td style="color:#6b7280;padding:5px 0;">Totaalbedrag:</td><td style="color:#1f2937;text-align:right;padding:5px 0;"><strong>${formatAmount(Number(invoice.total), currency, locale)}</strong></td></tr>
      </table>
    </td></tr></table>
    ${attachmentsInfo.length ? `<div style="text-align:center;margin:24px 0;">${attachmentsInfo.join('<br/>')}</div>` : ''}
    <p style="color:#4b5563;">${attachedLine}</p>`;

    const { html: emailHtml, text: emailText } = renderTenantEmail({
      tenantBrand: brand,
      locale,
      preheader: emailSubject,
      heading: t(locale, 'invoice.heading', { invoiceNumber: invoice.invoice_number }),
      intro: `<p>${customBody}</p>`,
      content: summary,
      poweredByLabel: t(locale, 'invoice.poweredBy'),
    });

    // Build recipients list
    const toEmails = [customer.email];
    const ccEmails = tenant.invoice_cc_email ? [tenant.invoice_cc_email] : undefined;
    const bccEmails = tenant.invoice_bcc_email ? [tenant.invoice_bcc_email] : undefined;

    // 1. Primaire e-mail naar klant (met PDF bijlage)
    logStep("Sending primary email", { to: customer.email, attachments: emailAttachments.length });

    const invoiceSender = EMAIL_SENDERS.invoices(tenant.name, (tenant as any).support_email || (tenant as any).owner_email);
    const emailResponse = await resend.emails.send({
      from: invoiceSender.from,
      reply_to: invoiceSender.replyTo,
      to: toEmails,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
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
          from: invoiceSender.from,
          reply_to: invoiceSender.replyTo,
          to: copyRecipients,
          subject: `[Kopie] ${emailSubject}`,
          html: emailHtml,
          text: emailText,
          attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
        });
        logStep("Copy email sent", { response: copyResponse });
      } catch (copyError) {
        logStep("WARNING: Copy email failed (non-blocking)", { error: copyError instanceof Error ? copyError.message : String(copyError) });
      }
    }

    // Always record sent_at, but NEVER downgrade a 'processing' or 'paid'
    // invoice back to 'sent'. Only transition to 'sent' from states where
    // that is a semantic upgrade (draft/unpaid) or a no-op refresh (sent).
    const sentAt = new Date().toISOString();
    const canPromoteToSent =
      invoice.status === 'draft' ||
      invoice.status === 'unpaid' ||
      invoice.status === 'sent';
    await supabaseClient
      .from("invoices")
      .update(
        canPromoteToSent
          ? { status: 'sent', sent_at: sentAt }
          : { sent_at: sentAt },
      )
      .eq("id", invoice_id);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Invoice email sent successfully",
      email_id: emailResponse?.data?.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
