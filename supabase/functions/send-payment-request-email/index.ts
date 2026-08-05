// CYCLE-2: sends the payment-request email for a pay-first billing cycle.
// Friendly request wording — never dunning/legal-claim language. Pay-first
// always mails; subscriptions.auto_send is intentionally not consulted.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { EMAIL_SENDERS } from "../_shared/emailSenders.ts";
import { getTenantBrand, renderTenantEmail, formatAmount } from "../_shared/tenantEmail.ts";
import { t } from "../_shared/tenantEmailI18n.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-PAYMENT-REQUEST-EMAIL] ${step}${suffix}`);
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not set");
    const resend = new Resend(resendApiKey);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { billing_cycle_id, reminder_level } = await req.json();
    if (!billing_cycle_id) throw new Error("billing_cycle_id is required");
    const reminderLevel: 1 | 2 | 3 | null =
      reminder_level === 1 || reminder_level === 2 || reminder_level === 3 ? reminder_level : null;

    const { data: cycle, error: cErr } = await supabase
      .from("billing_cycles")
      .select("id, tenant_id, customer_id, period_start, period_end, total, due_date, payment_request_number, pdf_path, checkout_session_url")
      .eq("id", billing_cycle_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!cycle) throw new Error("Billing cycle not found");

    const { data: tenant, error: tErr } = await supabase
      .from("tenants").select("*").eq("id", cycle.tenant_id).maybeSingle();
    if (tErr) throw tErr;
    if (!tenant) throw new Error("Tenant not found");

    let customer: any = null;
    if (cycle.customer_id) {
      const { data: c } = await supabase
        .from("customers").select("*").eq("id", cycle.customer_id).maybeSingle();
      customer = c;
    }
    if (!customer?.email) throw new Error("Customer email not found");

    const customerName =
      `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || customer.company_name || "Klant";
    const currency = tenant.currency || "EUR";
    const prNumber = cycle.payment_request_number ? String(cycle.payment_request_number) : cycle.id;

    // PDF attachment via service-role storage download (path only, no signed URL)
    const attachments: { filename: string; content: string }[] = [];
    if (cycle.pdf_path) {
      try {
        const { data, error } = await supabase.storage.from("invoices").download(cycle.pdf_path);
        if (!error && data) {
          const buf = await data.arrayBuffer();
          attachments.push({ filename: `${prNumber}.pdf`, content: arrayBufferToBase64(buf) });
          logStep("Attachment ready", { size: buf.byteLength });
        } else {
          logStep("WARNING: storage.download failed", { error: error?.message });
        }
      } catch (e) {
        logStep("WARNING: attachment load failed", { error: e instanceof Error ? e.message : String(e) });
      }
    }

    const brand = await getTenantBrand(supabase, cycle.tenant_id);
    const locale = brand.defaultLocale;

    const subject = reminderLevel
      ? t(locale, `paymentRequest.reminderSubject${reminderLevel}`, { requestNumber: prNumber, tenantName: brand.tenantName })
      : t(locale, "paymentRequest.subject", { requestNumber: prNumber, tenantName: brand.tenantName });

    const intro = reminderLevel
      ? t(locale, `paymentRequest.reminderIntro${reminderLevel}`, { customerName, requestNumber: prNumber })
      : t(locale, "paymentRequest.intro", { customerName, requestNumber: prNumber });

    const payBlock = cycle.checkout_session_url
      ? `<div style="text-align:center;margin:24px 0;">
          <a href="${cycle.checkout_session_url}" style="display:inline-block;padding:14px 28px;background:#3b82f6;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px;">
            ${t(locale, "paymentRequest.payNow")}
          </a>
        </div>`
      : "";

    const noticeBlock = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fef9e7;border-radius:8px;margin:20px 0;"><tr><td style="padding:14px 18px;color:#6b5200;font-weight:600;">
      ${t(locale, "paymentRequest.notice")}
    </td></tr></table>`;

    const summary = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f9fafb;border-radius:8px;margin:20px 0;"><tr><td style="padding:20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr><td style="color:#6b7280;padding:5px 0;">${t(locale, "paymentRequest.numberLabel")}:</td><td style="color:#1f2937;text-align:right;padding:5px 0;"><strong>${prNumber}</strong></td></tr>
        <tr><td style="color:#6b7280;padding:5px 0;">${t(locale, "paymentRequest.periodLabel")}:</td><td style="color:#1f2937;text-align:right;padding:5px 0;">${cycle.period_start} – ${cycle.period_end}</td></tr>
        ${cycle.due_date ? `<tr><td style="color:#6b7280;padding:5px 0;">${t(locale, "paymentRequest.dueLabel")}:</td><td style="color:#1f2937;text-align:right;padding:5px 0;">${cycle.due_date}</td></tr>` : ""}
        <tr><td style="color:#6b7280;padding:5px 0;">${t(locale, "paymentRequest.amountLabel")}:</td><td style="color:#1f2937;text-align:right;padding:5px 0;"><strong>${formatAmount(Number(cycle.total), currency, locale)}</strong></td></tr>
      </table>
    </td></tr></table>
    ${payBlock}
    ${noticeBlock}
    ${attachments.length > 0 ? `<p style="color:#4b5563;">${t(locale, "paymentRequest.attached")}</p>` : ""}`;

    const { html, text } = renderTenantEmail({
      tenantBrand: brand,
      locale,
      preheader: subject,
      heading: t(locale, "paymentRequest.heading", { requestNumber: prNumber }),
      intro: `<p>${intro}</p>`,
      content: summary,
      poweredByLabel: t(locale, "paymentRequest.poweredBy"),
    });

    const sender = EMAIL_SENDERS.invoices(tenant.name, (tenant as any).support_email || (tenant as any).owner_email);
    const response = await resend.emails.send({
      from: sender.from,
      reply_to: sender.replyTo,
      to: [customer.email],
      subject,
      html,
      text,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    logStep("Email sent", { to: customer.email, reminder_level: reminderLevel, response });

    return new Response(JSON.stringify({ success: true, email_id: (response as any)?.data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});