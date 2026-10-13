import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { tenantSender } from "../_shared/emailSenders.ts";
import {
  getTenantBrand,
  renderTenantEmail,
  renderOrderLineItems,
  renderAddressBlocks,
  renderTotalsBreakdown,
  resolveEmailLocale,
  type TenantLocale,
} from "../_shared/tenantEmail.ts";
import { t } from "../_shared/tenantEmailI18n.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: any) => {
  console.log(`[SEND-ORDER-CONFIRMATION] ${step}`, details ? JSON.stringify(details) : '');
};

// FOOD-2 — afhalen/levering in de bevestiging.
interface ServiceOrder { service_type?: string | null; requested_time?: string | null; payment_method?: string | null }
const SERVICE_TEXT: Record<TenantLocale, { pickup: string; delivery: string; asap: string; at: string; payPickup: string; payDelivery: string }> = {
  nl: { pickup: 'Afhalen', delivery: 'Levering', asap: 'zo snel mogelijk', at: 'om', payPickup: 'Je betaalt bij het afhalen, contant of met je bankkaart.', payDelivery: 'Je betaalt bij de levering, contant of met je bankkaart.' },
  en: { pickup: 'Pickup', delivery: 'Delivery', asap: 'as soon as possible', at: 'at', payPickup: 'You pay when you pick up your order, in cash or by card.', payDelivery: 'You pay on delivery, in cash or by card.' },
  fr: { pickup: 'À emporter', delivery: 'Livraison', asap: 'dès que possible', at: 'à', payPickup: 'Vous payez au retrait, en espèces ou par carte.', payDelivery: 'Vous payez à la livraison, en espèces ou par carte.' },
  de: { pickup: 'Abholung', delivery: 'Lieferung', asap: 'so schnell wie möglich', at: 'um', payPickup: 'Sie zahlen bei der Abholung, bar oder mit Karte.', payDelivery: 'Sie zahlen bei der Lieferung, bar oder mit Karte.' },
};
const DATE_LOCALE: Record<TenantLocale, string> = { nl: 'nl-BE', en: 'en-GB', fr: 'fr-BE', de: 'de-BE' };
function renderServiceBlock(order: ServiceOrder, locale: TenantLocale, accent: string): string {
  if (order.service_type !== 'pickup' && order.service_type !== 'local_delivery') return '';
  const tx = SERVICE_TEXT[locale] || SERVICE_TEXT.nl;
  const label = order.service_type === 'pickup' ? tx.pickup : tx.delivery;
  let when = tx.asap;
  if (order.requested_time) {
    const d = new Date(order.requested_time);
    const tz = 'Europe/Brussels';
    const day = new Intl.DateTimeFormat(DATE_LOCALE[locale] || 'nl-BE', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(d);
    const time = new Intl.DateTimeFormat(DATE_LOCALE[locale] || 'nl-BE', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    when = `${day} ${tx.at} ${time}`;
  }
  const pay = order.payment_method === 'pay_on_pickup' ? `<p style="margin:6px 0 0;font-size:14px;">${order.service_type === 'pickup' ? tx.payPickup : tx.payDelivery}</p>` : '';
  return `<div style="margin:16px 0;padding:14px 16px;border-radius:10px;border-left:4px solid ${accent};background:#f6f6f4;">
    <p style="margin:0;font-size:16px;"><strong>${label}:</strong> ${when}</p>${pay}
  </div>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  // FOOD-2 — versiestempel om een deploy zonder neveneffect te verifiëren.
  if (req.method === 'GET') return new Response(JSON.stringify({ ok: true, version: 'FOOD-2' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    await authenticateRequest(req);

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
        shipping_address, created_at, payment_method, tenant_id, service_type, requested_time,
        order_items(product_name, variant_title, quantity, unit_price, total_price)
      `)
      .eq('id', order_id).single();

    if (orderError || !order) throw new Error(`Order not found: ${orderError?.message}`);
    if (!order.customer_email) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no recipient email' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

    const brand = await getTenantBrand(supabase, tenantId);
    const locale: TenantLocale = await resolveEmailLocale(supabase, {
      explicit: (order as any).locale,
      tenantId,
      countryCode: order.shipping_address?.country,
      tenantDefault: brand.defaultLocale,
    });

    const items = ((order as any).order_items || []).map((i: any) => ({
      name: i.product_name || '',
      variant: i.variant_title || undefined,
      quantity: i.quantity || 1,
      total: Number(i.total_price) || 0,
    }));
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
    const addr = order.shipping_address || {};

    const labels = {
      subtotal: t(locale, 'order.subtotal'),
      shipping: t(locale, 'order.shipping'),
      discount: t(locale, 'order.discount'),
      tax: t(locale, 'order.tax'),
      total: t(locale, 'order.total'),
    };

    // FOOD-2 — afhalen of levering met tijdstip, en "betalen bij afhalen". Teksten staan
    // hier lokaal (4 e-mailtalen), zodat _shared/tenantEmailI18n.ts en al zijn functies
    // ongemoeid blijven.
    const serviceBlock = renderServiceBlock(order as unknown as ServiceOrder, locale, brand.primaryColor);

    const content = `
      ${serviceBlock}
      <h2 style="margin:24px 0 8px;font-size:18px;font-weight:600;">${t(locale, 'order.summary')} — ${orderNumber}</h2>
      ${renderOrderLineItems(items, currency, locale, labels.subtotal)}
      ${(order as unknown as ServiceOrder).service_type === 'pickup' ? '' : renderAddressBlocks({
        shipping: {
          name: addr.name,
          line1: [addr.street, addr.house_number].filter(Boolean).join(' '),
          postalCode: addr.postal_code,
          city: addr.city,
          country: addr.country,
        },
        shippingLabel: t(locale, 'order.shippingLabel'),
      })}
      ${renderTotalsBreakdown({ ...totals, currency, locale, labels, accentColor: brand.primaryColor })}
    `;

    const { html, text } = renderTenantEmail({
      tenantBrand: brand,
      locale,
      preheader: t(locale, 'order.thanks'),
      heading: t(locale, 'order.heading'),
      intro: `<p>${t(locale, 'order.intro', { customerName })}</p>`,
      content,
      footerNote: t(locale, 'order.nextStep'),
      poweredByLabel: t(locale, 'order.poweredBy'),
    });
    const subject = t(locale, 'order.subject', { orderNumber });

    log('Sending', { to: order.customer_email, subject });

    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const resend = new Resend(resendApiKey);

    const orderSender = tenantSender(brand.senderSource);
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: orderSender.from,
      to: [order.customer_email],
      subject,
      html,
      text,
      reply_to: orderSender.replyTo,
    });

    if (emailError) throw new Error(`Email verzenden mislukt: ${emailError.message}`);

    log('Sent', { id: emailData?.id });
    return new Response(JSON.stringify({ success: true, email_id: emailData?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    log('Error', { message: error.message });
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
