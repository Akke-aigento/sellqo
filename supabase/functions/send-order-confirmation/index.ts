import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: any) => {
  console.log(`[SEND-ORDER-CONFIRMATION] ${step}`, details ? JSON.stringify(details) : '');
};

type Locale = 'nl' | 'en' | 'fr';

interface TenantBranding {
  name: string;
  primary_color?: string;
  logo_url?: string;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
  country?: string;
}

const labels: Record<Locale, Record<string, string>> = {
  nl: {
    subtotal: 'Subtotaal', shipping: 'Verzending', discount: 'Korting',
    tax: 'BTW', total: 'Totaal', orderSummary: 'Besteloverzicht',
    shippingAddress: 'Verzendadres', greeting: 'Beste',
    thanks: 'Bedankt voor je bestelling! We hebben je bestelling en betaling ontvangen en gaan deze direct voor je klaarmaken.',
    nextStep: 'Je ontvangt automatisch een verzendbevestiging met track & trace zodra je pakket onderweg is.',
    closing: 'Vragen? Neem gerust contact op via',
    regards: 'Met vriendelijke groet',
    quantity: 'Aantal',
  },
  en: {
    subtotal: 'Subtotal', shipping: 'Shipping', discount: 'Discount',
    tax: 'VAT', total: 'Total', orderSummary: 'Order summary',
    shippingAddress: 'Shipping address', greeting: 'Dear',
    thanks: 'Thank you for your order! We have received your order and payment, and we are preparing it right away.',
    nextStep: 'You will receive a shipping confirmation with tracking information once your order is on its way.',
    closing: 'Questions? Feel free to reach out at',
    regards: 'Kind regards',
    quantity: 'Qty',
  },
  fr: {
    subtotal: 'Sous-total', shipping: 'Livraison', discount: 'Remise',
    tax: 'TVA', total: 'Total', orderSummary: 'Récapitulatif de commande',
    shippingAddress: 'Adresse de livraison', greeting: 'Cher/Chère',
    thanks: 'Merci pour votre commande ! Nous avons bien reçu votre commande et votre paiement, et nous la préparons immédiatement.',
    nextStep: 'Vous recevrez une confirmation d\'expédition avec un numéro de suivi dès que votre colis sera en route.',
    closing: 'Des questions ? N\'hésitez pas à nous contacter à',
    regards: 'Cordialement',
    quantity: 'Qté',
  },
};

const subjects: Record<Locale, (orderNumber: string) => string> = {
  nl: (n) => `Bedankt voor je bestelling — ${n}`,
  en: (n) => `Thank you for your order — ${n}`,
  fr: (n) => `Merci pour votre commande — ${n}`,
};

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
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
                <a href="mailto:${esc(supportEmail)}" style="color:${primaryColor};text-decoration:none;">${esc(supportEmail)}</a>
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

function buildItemsTable(
  items: any[],
  totals: { subtotal: number; shipping: number; discount: number; tax: number; total: number },
  currency: string,
  locale: Locale,
  primaryColor: string,
): string {
  const L = labels[locale];
  const fmt = (a: number) => formatAmount(a, currency, locale);

  const rows = items.map((item: any) => `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:12px 8px;font-size:14px;color:#111827;">
        <div style="font-weight:500;">${esc(item.product_name || '')}</div>
        ${item.variant_name ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${esc(item.variant_name)}</div>` : ''}
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">${L.quantity}: ${item.quantity}</div>
      </td>
      <td style="padding:12px 8px;font-size:14px;color:#111827;text-align:right;white-space:nowrap;">
        ${fmt(item.total_price || 0)}
      </td>
    </tr>
  `).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-collapse:collapse;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 8px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Product</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Subtotaal</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr>
          <td style="padding:12px 8px;font-size:14px;color:#6b7280;text-align:right;">${L.subtotal}</td>
          <td style="padding:12px 8px;font-size:14px;color:#374151;text-align:right;white-space:nowrap;">${fmt(totals.subtotal)}</td>
        </tr>
        ${totals.shipping > 0 ? `
        <tr>
          <td style="padding:8px;font-size:14px;color:#6b7280;text-align:right;">${L.shipping}</td>
          <td style="padding:8px;font-size:14px;color:#374151;text-align:right;white-space:nowrap;">${fmt(totals.shipping)}</td>
        </tr>` : ''}
        ${totals.discount > 0 ? `
        <tr>
          <td style="padding:8px;font-size:14px;color:#059669;text-align:right;">${L.discount}</td>
          <td style="padding:8px;font-size:14px;color:#059669;text-align:right;white-space:nowrap;">-${fmt(totals.discount)}</td>
        </tr>` : ''}
        ${totals.tax > 0 ? `
        <tr>
          <td style="padding:8px;font-size:14px;color:#6b7280;text-align:right;">${L.tax}</td>
          <td style="padding:8px;font-size:14px;color:#374151;text-align:right;white-space:nowrap;">${fmt(totals.tax)}</td>
        </tr>` : ''}
        <tr style="border-top:2px solid #e5e7eb;">
          <td style="padding:14px 8px;font-size:16px;font-weight:700;color:${primaryColor};text-align:right;">${L.total}</td>
          <td style="padding:14px 8px;font-size:16px;font-weight:700;color:${primaryColor};text-align:right;white-space:nowrap;">${fmt(totals.total)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

function buildShippingAddress(addr: any, label: string): string {
  if (!addr || typeof addr !== 'object') return '';
  const lines = [
    addr.name,
    [addr.street, addr.house_number].filter(Boolean).join(' '),
    [addr.postal_code, addr.city].filter(Boolean).join(' '),
    addr.country,
  ].filter(Boolean).map(esc);

  if (lines.length === 0) return '';

  return `
    <div style="margin:24px 0;padding:16px;background:#f9fafb;border-radius:6px;">
      <div style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">${label}</div>
      <div style="font-size:14px;color:#374151;line-height:1.5;">${lines.join('<br/>')}</div>
    </div>
  `;
}

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

    const { order_id } = await req.json();
    if (!order_id) throw new Error('order_id is required');

    log('Processing', { order_id });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, order_number, customer_email, customer_name, total, subtotal,
        shipping_cost, tax_amount, discount_amount, currency, locale,
        shipping_address, created_at, payment_method, tenant_id,
        tenants(name, primary_color, logo_url, support_email, owner_email,
          address, postal_code, city, country),
        order_items(product_name, variant_name, quantity, unit_price, total_price)
      `)
      .eq('id', order_id).single();

    if (orderError || !order) throw new Error(`Order not found: ${orderError?.message}`);
    if (!order.customer_email) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no recipient email' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tenant = (order as any).tenants as any;
    const tenantId = order.tenant_id;

    // Check customer_communication_settings toggle
    const { data: commSettings } = await supabase
      .from('customer_communication_settings')
      .select('email_enabled')
      .eq('tenant_id', tenantId)
      .eq('trigger_type', 'order_confirmation')
      .maybeSingle();

    if (commSettings && commSettings.email_enabled === false) {
      log('Order confirmation disabled by tenant', { tenantId });
      return new Response(JSON.stringify({ skipped: true, reason: 'order_confirmation disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const locale = await resolveLocale(supabase, order, tenantId);
    const L = labels[locale];
    const supportEmail = tenant?.support_email || tenant?.owner_email || 'admin@sellqo.app';
    const tenantName = tenant?.name || 'SellQo';

    const tenantBranding: TenantBranding = {
      name: tenantName,
      primary_color: tenant?.primary_color,
      logo_url: tenant?.logo_url,
      street: tenant?.address,
      house_number: undefined,
      postal_code: tenant?.postal_code,
      city: tenant?.city,
      country: tenant?.country,
    };
    const primaryColor = tenant?.primary_color || '#3b82f6';

    const items = (order as any).order_items || [];
    const totals = {
      subtotal: Number(order.subtotal) || 0,
      shipping: Number(order.shipping_cost) || 0,
      discount: Number(order.discount_amount) || 0,
      tax: Number(order.tax_amount) || 0,
      total: Number(order.total) || 0,
    };

    const currency = order.currency || 'EUR';
    const orderNumber = order.order_number || order.id.substring(0, 8);
    const customerName = order.customer_name || 'Klant';

    const itemsTable = buildItemsTable(items, totals, currency, locale, primaryColor);
    const shippingBlock = buildShippingAddress(order.shipping_address, L.shippingAddress);

    const body = `
      <p style="margin:0 0 16px;">${L.greeting} ${esc(customerName)},</p>
      <p style="margin:0 0 16px;">${L.thanks}</p>
      <h2 style="margin:24px 0 8px;font-size:18px;font-weight:600;color:#111827;">${L.orderSummary} — ${esc(orderNumber)}</h2>
      ${itemsTable}
      ${shippingBlock}
      <p style="margin:16px 0;color:#6b7280;font-size:14px;">${L.nextStep}</p>
      <p style="margin:24px 0 0;color:#6b7280;font-size:14px;">${L.closing} <a href="mailto:${esc(supportEmail)}" style="color:${primaryColor};text-decoration:none;">${esc(supportEmail)}</a>.</p>
      <p style="margin:24px 0 0;">${L.regards},<br/><strong>${esc(tenantName)}</strong></p>
    `;

    const html = wrapHtml(body, tenantBranding, supportEmail);
    const subject = subjects[locale](orderNumber);

    log('Sending', { to: order.customer_email, subject });

    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const resend = new Resend(resendApiKey);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${tenantName} <bestellingen@sellqo.app>`,
      to: [order.customer_email],
      subject,
      html,
      reply_to: supportEmail !== 'admin@sellqo.app' ? supportEmail : undefined,
    });

    if (emailError) throw new Error(`Email verzenden mislukt: ${emailError.message}`);

    log('Sent', { id: emailData?.id });
    return new Response(JSON.stringify({ success: true, email_id: emailData?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    log('Error', { message: error.message });
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
