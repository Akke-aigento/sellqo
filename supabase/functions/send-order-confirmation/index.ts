import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { EMAIL_SENDERS } from "../_shared/emailSenders.ts";
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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
        shipping_address, created_at, payment_method, tenant_id,
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

    const content = `
      <h2 style="margin:24px 0 8px;font-size:18px;font-weight:600;">${t(locale, 'order.summary')} — ${orderNumber}</h2>
      ${renderOrderLineItems(items, currency, locale, labels.subtotal)}
      ${renderAddressBlocks({
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

    const orderSender = EMAIL_SENDERS.orders(brand.tenantName, brand.supportEmail);
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
