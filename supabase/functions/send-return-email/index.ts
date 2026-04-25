import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: any) => {
  console.log(`[SEND-RETURN-EMAIL] ${step}`, details ? JSON.stringify(details) : '');
};

type Locale = 'nl' | 'en' | 'fr';
type ReturnEmailEvent = 'request_received' | 'approved' | 'package_received' | 'refund_processed';

interface TenantBranding {
  name: string;
  primary_color?: string;
  logo_url?: string;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
}

interface TemplateData {
  tenant: TenantBranding;
  customerName: string;
  orderNumber: string;
  rmaNumber: string;
  refundAmountFormatted: string;
  refundMethod: string;
  items: { name: string; quantity: number }[];
  supportEmail: string;
}

// ── Locale resolution ──────────────────────────────────────

async function resolveLocale(supabase: any, order: any, tenantId: string): Promise<Locale> {
  if (order.locale && ['nl', 'en', 'fr'].includes(order.locale)) return order.locale as Locale;

  const { data: domains } = await supabase
    .from('tenant_domains').select('locale')
    .eq('tenant_id', tenantId).eq('is_active', true);

  if (domains?.length === 1 && domains[0].locale) {
    const loc = domains[0].locale.toLowerCase();
    if (['nl', 'en', 'fr'].includes(loc)) return loc as Locale;
  }

  const country = (order.shipping_address?.country || '').toUpperCase();
  if (['NL', 'BE'].includes(country)) return 'nl';
  if (['FR', 'CH', 'LU', 'MC'].includes(country)) return 'fr';
  return 'nl';
}

function formatAmount(amount: number, currency: string, locale: Locale): string {
  const localeMap: Record<Locale, string> = { nl: 'nl-NL', en: 'en-US', fr: 'fr-FR' };
  return new Intl.NumberFormat(localeMap[locale], { style: 'currency', currency: currency || 'EUR' }).format(amount);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function itemList(items: TemplateData['items']): string {
  return items.map(i => `<li>${esc(i.name)} × ${i.quantity}</li>`).join('');
}

function refundLabel(method: string, locale: Locale): string {
  const m: Record<string, Record<Locale, string>> = {
    stripe: { nl: 'je oorspronkelijke betaalmethode', en: 'your original payment method', fr: 'votre mode de paiement initial' },
    manual: { nl: 'bankoverschrijving', en: 'bank transfer', fr: 'virement bancaire' },
    bolcom: { nl: 'Bol.com', en: 'Bol.com', fr: 'Bol.com' },
    amazon: { nl: 'Amazon', en: 'Amazon', fr: 'Amazon' },
  };
  return m[method]?.[locale] || method;
}

const subjects: Record<ReturnEmailEvent, Record<Locale, (d: TemplateData) => string>> = {
  request_received: {
    nl: (d) => `Retour-aanvraag ontvangen — RMA ${d.rmaNumber}`,
    en: (d) => `Return request received — RMA ${d.rmaNumber}`,
    fr: (d) => `Demande de retour reçue — RMA ${d.rmaNumber}`,
  },
  approved: {
    nl: () => `Je retour is goedgekeurd — instructies binnen`,
    en: () => `Your return has been approved — instructions inside`,
    fr: () => `Votre retour est approuvé — instructions ci-dessous`,
  },
  package_received: {
    nl: () => `We hebben je pakket ontvangen`,
    en: () => `We have received your package`,
    fr: () => `Nous avons bien reçu votre colis`,
  },
  refund_processed: {
    nl: (d) => `Je refund van ${d.refundAmountFormatted} is verwerkt`,
    en: (d) => `Your refund of ${d.refundAmountFormatted} has been processed`,
    fr: (d) => `Votre remboursement de ${d.refundAmountFormatted} a été traité`,
  },
};

const bodies: Record<ReturnEmailEvent, Record<Locale, (d: TemplateData) => string>> = {
  request_received: {
    nl: (d) => `<p>Beste ${esc(d.customerName)},</p><p>We hebben je retour-aanvraag ontvangen voor bestelling <strong>${esc(d.orderNumber)}</strong> (RMA: <strong>${esc(d.rmaNumber)}</strong>).</p><p><strong>Artikelen:</strong></p><ul>${itemList(d.items)}</ul><p>We bekijken je aanvraag en je ontvangt bericht zodra deze is goedgekeurd.</p><p>Met vriendelijke groet,<br/>${esc(d.tenant.name)}</p>`,
    en: (d) => `<p>Dear ${esc(d.customerName)},</p><p>We have received your return request for order <strong>${esc(d.orderNumber)}</strong> (RMA: <strong>${esc(d.rmaNumber)}</strong>).</p><p><strong>Items:</strong></p><ul>${itemList(d.items)}</ul><p>We'll review your request and notify you once it's approved.</p><p>Kind regards,<br/>${esc(d.tenant.name)}</p>`,
    fr: (d) => `<p>Cher/Chère ${esc(d.customerName)},</p><p>Nous avons bien reçu votre demande de retour pour la commande <strong>${esc(d.orderNumber)}</strong> (RMA : <strong>${esc(d.rmaNumber)}</strong>).</p><p><strong>Articles :</strong></p><ul>${itemList(d.items)}</ul><p>Nous examinerons votre demande et vous informerons dès qu'elle sera approuvée.</p><p>Cordialement,<br/>${esc(d.tenant.name)}</p>`,
  },
  approved: {
    nl: (d) => `<p>Beste ${esc(d.customerName)},</p><p>Je retour voor bestelling <strong>${esc(d.orderNumber)}</strong> (RMA: <strong>${esc(d.rmaNumber)}</strong>) is goedgekeurd!</p><p><strong>Artikelen:</strong></p><ul>${itemList(d.items)}</ul><p>Stuur de artikelen retour. Zodra we je pakket ontvangen, sturen we je opnieuw een e-mail.</p><p>Met vriendelijke groet,<br/>${esc(d.tenant.name)}</p>`,
    en: (d) => `<p>Dear ${esc(d.customerName)},</p><p>Your return for order <strong>${esc(d.orderNumber)}</strong> (RMA: <strong>${esc(d.rmaNumber)}</strong>) has been approved!</p><p><strong>Items:</strong></p><ul>${itemList(d.items)}</ul><p>Please ship the items back to us. We'll email you again once we receive your package.</p><p>Kind regards,<br/>${esc(d.tenant.name)}</p>`,
    fr: (d) => `<p>Cher/Chère ${esc(d.customerName)},</p><p>Votre retour pour la commande <strong>${esc(d.orderNumber)}</strong> (RMA : <strong>${esc(d.rmaNumber)}</strong>) a été approuvé !</p><p><strong>Articles :</strong></p><ul>${itemList(d.items)}</ul><p>Veuillez nous renvoyer les articles. Nous vous enverrons un e-mail dès réception de votre colis.</p><p>Cordialement,<br/>${esc(d.tenant.name)}</p>`,
  },
  package_received: {
    nl: (d) => `<p>Beste ${esc(d.customerName)},</p><p>We hebben je retourpakket ontvangen voor bestelling <strong>${esc(d.orderNumber)}</strong> (RMA: <strong>${esc(d.rmaNumber)}</strong>).</p><p><strong>Artikelen:</strong></p><ul>${itemList(d.items)}</ul><p>We inspecteren de artikelen. Zodra alles in orde is, verwerken we je refund en ontvang je hierover bericht.</p><p>Met vriendelijke groet,<br/>${esc(d.tenant.name)}</p>`,
    en: (d) => `<p>Dear ${esc(d.customerName)},</p><p>We've received your return package for order <strong>${esc(d.orderNumber)}</strong> (RMA: <strong>${esc(d.rmaNumber)}</strong>).</p><p><strong>Items:</strong></p><ul>${itemList(d.items)}</ul><p>We're inspecting the items. Once everything checks out, we'll process your refund and notify you.</p><p>Kind regards,<br/>${esc(d.tenant.name)}</p>`,
    fr: (d) => `<p>Cher/Chère ${esc(d.customerName)},</p><p>Nous avons bien reçu votre colis retour pour la commande <strong>${esc(d.orderNumber)}</strong> (RMA : <strong>${esc(d.rmaNumber)}</strong>).</p><p><strong>Articles :</strong></p><ul>${itemList(d.items)}</ul><p>Nous inspectons les articles. Une fois la vérification terminée, nous traiterons votre remboursement et vous en informerons.</p><p>Cordialement,<br/>${esc(d.tenant.name)}</p>`,
  },
  refund_processed: {
    nl: (d) => `<p>Beste ${esc(d.customerName)},</p><p>Je refund van <strong>${d.refundAmountFormatted}</strong> voor bestelling <strong>${esc(d.orderNumber)}</strong> (RMA: <strong>${esc(d.rmaNumber)}</strong>) is verwerkt via ${refundLabel(d.refundMethod, 'nl')}.</p><p><strong>Artikelen:</strong></p><ul>${itemList(d.items)}</ul><p>Het duurt doorgaans 3-5 werkdagen voordat het bedrag op je rekening verschijnt.</p><p>Met vriendelijke groet,<br/>${esc(d.tenant.name)}</p>`,
    en: (d) => `<p>Dear ${esc(d.customerName)},</p><p>Your refund of <strong>${d.refundAmountFormatted}</strong> for order <strong>${esc(d.orderNumber)}</strong> (RMA: <strong>${esc(d.rmaNumber)}</strong>) has been processed via ${refundLabel(d.refundMethod, 'en')}.</p><p><strong>Items:</strong></p><ul>${itemList(d.items)}</ul><p>It typically takes 3-5 business days for the amount to appear on your statement.</p><p>Kind regards,<br/>${esc(d.tenant.name)}</p>`,
    fr: (d) => `<p>Cher/Chère ${esc(d.customerName)},</p><p>Votre remboursement de <strong>${d.refundAmountFormatted}</strong> pour la commande <strong>${esc(d.orderNumber)}</strong> (RMA : <strong>${esc(d.rmaNumber)}</strong>) a été traité via ${refundLabel(d.refundMethod, 'fr')}.</p><p><strong>Articles :</strong></p><ul>${itemList(d.items)}</ul><p>Le montant apparaîtra généralement sur votre relevé sous 3 à 5 jours ouvrables.</p><p>Cordialement,<br/>${esc(d.tenant.name)}</p>`,
  },
};

// ── Canonical SellQo layout ─────────────────────────────────

function wrapHtml(body: string, tenant: TenantBranding, supportEmail: string): string {
  const primaryColor = tenant.primary_color || '#3b82f6';
  const tenantName = esc(tenant.name);
  const address = [tenant.street, tenant.house_number, tenant.postal_code, tenant.city]
    .filter(Boolean).join(', ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:${primaryColor};padding:24px 32px;text-align:center;">
              ${tenant.logo_url
                ? `<img src="${esc(tenant.logo_url)}" alt="${tenantName}" style="max-height:48px;max-width:200px;">`
                : `<span style="color:#ffffff;font-size:24px;font-weight:600;">${tenantName}</span>`}
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-size:16px;line-height:1.6;color:#374151;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">
                <strong>${tenantName}</strong>${address ? ` &middot; ${esc(address)}` : ''}
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Vragen? <a href="mailto:${esc(supportEmail)}" style="color:${primaryColor};text-decoration:none;">${esc(supportEmail)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getTemplate(event: ReturnEmailEvent, locale: Locale, data: TemplateData): { subject: string; html: string } {
  return {
    subject: subjects[event][locale](data),
    html: wrapHtml(bodies[event][locale](data), data.tenant, data.supportEmail),
  };
}

const SETTING_KEY: Record<ReturnEmailEvent, string> = {
  request_received: 'notify_customer_request_received',
  approved: 'notify_customer_approved',
  package_received: 'notify_customer_package_received',
  refund_processed: 'notify_customer_refund_processed',
};

// ── Handler ─────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY is not set');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { return_id, event } = await req.json();
    if (!return_id || !event) throw new Error('return_id and event are required');

    const validEvents: ReturnEmailEvent[] = ['request_received', 'approved', 'package_received', 'refund_processed'];
    if (!validEvents.includes(event)) throw new Error(`Invalid event: ${event}`);

    log('Processing', { return_id, event });

    const { data: ret, error: retError } = await supabase
      .from('returns')
      .select(`
        id, rma_number, refund_amount, refund_method,
        orders!returns_order_id_fkey(
          order_number, customer_email, customer_name,
          shipping_address, total, currency, locale, tenant_id,
          tenants(name, support_email, contact_email, primary_color, logo_url, street, house_number, postal_code, city, country, vat_number)
        ),
        return_items(product_name, quantity)
      `)
      .eq('id', return_id).single();

    if (retError || !ret) throw new Error('Return niet gevonden');

    const order = ret.orders as any;
    if (!order) throw new Error('Order niet gevonden bij retour');

    const tenant = order.tenants as any;
    const tenantId = order.tenant_id;

    const { data: settings } = await supabase
      .from('tenant_return_settings')
      .select('notify_customer_request_received, notify_customer_approved, notify_customer_package_received, notify_customer_refund_processed')
      .eq('tenant_id', tenantId).maybeSingle();

    const settingKey = SETTING_KEY[event as ReturnEmailEvent];
    if (settings && (settings as Record<string, any>)[settingKey] === false) {
      log('Notification disabled', { event });
      return new Response(JSON.stringify({ skipped: true, reason: 'notification disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supportEmail = tenant?.support_email || tenant?.contact_email || 'admin@sellqo.app';
    const to = order.customer_email;

    if (!to) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no recipient email' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const locale = await resolveLocale(supabase, order, tenantId);
    log('Resolved', { locale, to });

    const tenantBranding: TenantBranding = {
      name: tenant?.name || 'SellQo',
      primary_color: tenant?.primary_color,
      logo_url: tenant?.logo_url,
      street: tenant?.street,
      house_number: tenant?.house_number,
      postal_code: tenant?.postal_code,
      city: tenant?.city,
    };

    const templateData: TemplateData = {
      tenant: tenantBranding,
      customerName: order.customer_name || 'Klant',
      orderNumber: order.order_number || '-',
      rmaNumber: ret.rma_number || '-',
      refundAmountFormatted: formatAmount(ret.refund_amount || 0, order.currency || 'EUR', locale),
      refundMethod: ret.refund_method || 'manual',
      items: (ret.return_items || []).map((i: any) => ({ name: i.product_name || 'Onbekend product', quantity: i.quantity || 1 })),
      supportEmail,
    };

    const template = getTemplate(event as ReturnEmailEvent, locale, templateData);
    log('Sending', { to, subject: template.subject });

    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const resend = new Resend(resendApiKey);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${tenant?.name || 'SellQo'} <retouren@sellqo.app>`,
      to: [to],
      subject: template.subject,
      html: template.html,
      reply_to: supportEmail !== 'admin@sellqo.app' ? supportEmail : undefined,
    });

    if (emailError) throw new Error(`Email verzenden mislukt: ${emailError.message}`);

    log('Sent', { id: emailData?.id });
    return new Response(JSON.stringify({ success: true, email_id: emailData?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log('Error', { message });
    return new Response(JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
