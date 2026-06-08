import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "nl" | "en" | "fr" | "de";

const SUBJECT: Record<Lang, (n: string, t: string) => string> = {
  nl: (n, t) => `Creditnota ${n} - ${t}`,
  en: (n, t) => `Credit note ${n} - ${t}`,
  fr: (n, t) => `Note de crédit ${n} - ${t}`,
  de: (n, t) => `Gutschrift ${n} - ${t}`,
};

const BODY_TEXT: Record<Lang, { greeting: string; intro: (inv: string) => string; outro: string; attach: string }> = {
  nl: {
    greeting: "Beste",
    intro: (inv) => `Hierbij ontvangt u de creditnota met betrekking tot factuur <strong>${inv}</strong>.`,
    outro: "Bij vragen kunt u contact met ons opnemen.",
    attach: "De creditnota vindt u als PDF in de bijlage.",
  },
  en: {
    greeting: "Dear",
    intro: (inv) => `Please find attached the credit note regarding invoice <strong>${inv}</strong>.`,
    outro: "If you have any questions, feel free to contact us.",
    attach: "The credit note is attached as a PDF.",
  },
  fr: {
    greeting: "Cher/Chère",
    intro: (inv) => `Veuillez trouver ci-jointe la note de crédit relative à la facture <strong>${inv}</strong>.`,
    outro: "N'hésitez pas à nous contacter en cas de question.",
    attach: "La note de crédit est jointe en PDF.",
  },
  de: {
    greeting: "Sehr geehrte/r",
    intro: (inv) => `Anbei erhalten Sie die Gutschrift zur Rechnung <strong>${inv}</strong>.`,
    outro: "Bei Fragen stehen wir Ihnen gerne zur Verfügung.",
    attach: "Die Gutschrift finden Sie als PDF im Anhang.",
  },
};

function pickLang(input: unknown, customer: any, tenant: any): Lang {
  const allowed: Lang[] = ["nl", "en", "fr", "de"];
  if (typeof input === "string" && allowed.includes(input as Lang)) return input as Lang;
  const cl = (customer?.preferred_language || "").toLowerCase();
  if (allowed.includes(cl as Lang)) return cl as Lang;
  const tl = (tenant?.default_invoice_language || tenant?.language || "").toLowerCase();
  if (allowed.includes(tl as Lang)) return tl as Lang;
  return "nl";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function fmt(n: number, currency = "EUR"): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(Number(n) || 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not set");
    const resend = new Resend(resendApiKey);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { credit_note_id, language } = await req.json().catch(() => ({}));
    if (!credit_note_id) {
      return new Response(JSON.stringify({ success: false, error: "credit_note_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cn, error: cnErr } = await admin
      .from("credit_notes")
      .select(`*, original_invoice:invoices!original_invoice_id(*), customer:customers(*)`)
      .eq("id", credit_note_id)
      .maybeSingle();
    if (cnErr || !cn) throw new Error(cnErr?.message || "Credit note not found");

    const auth = await authenticateRequest(req, cn.tenant_id);
    requireRole(auth, cn.tenant_id, ["tenant_admin", "staff", "accountant"]);

    const { data: tenant, error: tErr } = await admin
      .from("tenants").select("*").eq("id", cn.tenant_id).single();
    if (tErr || !tenant) throw new Error("Tenant not found");

    // Resolve recipient
    let customer = cn.customer;
    if (!customer?.email && cn.original_invoice?.order_id) {
      const { data: order } = await admin.from("orders").select("customer_email, customer_name").eq("id", cn.original_invoice.order_id).single();
      if (order) customer = { email: order.customer_email, first_name: order.customer_name?.split(" ")[0] || "", last_name: order.customer_name?.split(" ").slice(1).join(" ") || "" };
    }
    if (!customer?.email) throw new Error("Customer email not found");

    const lang = pickLang(language, customer, tenant);
    const currency = tenant.currency || "EUR";
    const customerName = (customer.company_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "").trim();

    // Ensure PDF exists — regenerate if missing
    let pdfUrl: string | null = cn.pdf_url;
    if (!pdfUrl) {
      const url = Deno.env.get("SUPABASE_URL")!;
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const r = await fetch(`${url}/functions/v1/generate-credit-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}`, "apikey": key },
        body: JSON.stringify({ credit_note_id, language: lang }),
      });
      const j = await r.json();
      if (!j?.success) throw new Error(`PDF generation failed: ${j?.error || r.status}`);
      pdfUrl = j.pdf_url;
    }

    // Download PDF for attachment
    const attachments: { filename: string; content: string }[] = [];
    if (pdfUrl) {
      try {
        const r = await fetch(pdfUrl);
        if (r.ok) {
          const buf = await r.arrayBuffer();
          attachments.push({ filename: `${cn.credit_note_number}.pdf`, content: arrayBufferToBase64(buf) });
        }
      } catch (e) {
        console.warn("[send-credit-note-email] PDF download failed", e);
      }
    }

    const invoiceNumber = cn.original_invoice?.invoice_number || "-";
    const subject = SUBJECT[lang](cn.credit_note_number, tenant.name);
    const body = BODY_TEXT[lang];

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1);">
<tr><td style="background:${tenant.primary_color || "#dc2626"};padding:30px;text-align:center;">
${tenant.logo_url ? `<img src="${tenant.logo_url}" alt="${tenant.name}" style="max-height:50px;">` : `<h1 style="color:#fff;margin:0;font-size:24px;">${tenant.name}</h1>`}
</td></tr>
<tr><td style="padding:40px 30px;color:#1f2937;">
<h2 style="margin:0 0 20px;font-size:20px;">${subject}</h2>
<p style="margin:0 0 16px;line-height:1.6;">${body.greeting} ${customerName || ""},</p>
<p style="margin:0 0 16px;line-height:1.6;">${body.intro(invoiceNumber)}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin:20px 0;"><tr><td style="padding:20px;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="color:#6b7280;padding:4px 0;">${cn.credit_note_number}</td><td style="color:#dc2626;text-align:right;padding:4px 0;font-weight:bold;">-${fmt(Math.abs(Number(cn.total || 0)), currency)}</td></tr>
</table></td></tr></table>
<p style="margin:0 0 16px;line-height:1.6;">${body.attach}</p>
<p style="margin:24px 0 0;line-height:1.6;color:#4b5563;">${body.outro}</p>
</td></tr>
<tr><td style="background:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
${tenant.name}${tenant.vat_number ? ` | BTW: ${tenant.vat_number}` : ""}
</td></tr>
</table></td></tr></table></body></html>`;

    const toEmails = [customer.email];
    const ccEmails = tenant.invoice_cc_email ? [tenant.invoice_cc_email] : undefined;
    const bccEmails = tenant.invoice_bcc_email ? [tenant.invoice_bcc_email] : undefined;

    const primary = await resend.emails.send({
      from: `${tenant.name} <noreply@sellqo.app>`,
      to: toEmails,
      subject,
      html,
      attachments: attachments.length ? attachments : undefined,
    });

    const copyRecipients = [...(ccEmails || []), ...(bccEmails || [])];
    if (copyRecipients.length) {
      try {
        await resend.emails.send({
          from: `${tenant.name} <noreply@sellqo.app>`,
          to: copyRecipients,
          subject: `[Kopie] ${subject}`,
          html,
          attachments: attachments.length ? attachments : undefined,
        });
      } catch (e) {
        console.warn("[send-credit-note-email] copy failed", e);
      }
    }

    // Mark sent
    await admin.from("credit_notes").update({
      sent_at: new Date().toISOString(),
      status: "sent",
    }).eq("id", credit_note_id);

    // Audit trail — best-effort, do not fail the request on log errors.
    const { error: auditError } = await admin.from("admin_actions_log").insert({
      admin_user_id: auth.user_id === "service_role" ? null : auth.user_id,
      target_tenant_id: cn.tenant_id,
      action_type: "credit_note_email_sent",
      action_details: {
        credit_note_id: cn.id,
        credit_note_number: cn.credit_note_number,
        recipient: customer.email,
        cc: ccEmails || [],
        bcc: bccEmails || [],
        language: lang,
      },
    });
    if (auditError) console.warn("[send-credit-note-email] audit log failed", auditError);

    return new Response(JSON.stringify({ success: true, email_id: primary?.data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error("[send-credit-note-email] error", error?.message);
    return new Response(JSON.stringify({ success: false, error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});