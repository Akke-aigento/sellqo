import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getTemplate, type ReturnEmailEvent, type TemplateData } from "./templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: any) => {
  console.log(`[SEND-RETURN-EMAIL] ${step}`, details ? JSON.stringify(details) : '');
};

type Locale = 'nl' | 'en' | 'fr';

async function resolveLocale(supabase: any, order: any, tenantId: string): Promise<Locale> {
  if (order.locale && ['nl', 'en', 'fr'].includes(order.locale)) {
    return order.locale as Locale;
  }

  const { data: domains } = await supabase
    .from('tenant_domains')
    .select('locale')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

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
  return new Intl.NumberFormat(localeMap[locale], {
    style: 'currency', currency: currency || 'EUR',
  }).format(amount);
}

const SETTING_KEY: Record<ReturnEmailEvent, string> = {
  request_received: 'notify_customer_request_received',
  approved: 'notify_customer_approved',
  package_received: 'notify_customer_package_received',
  refund_processed: 'notify_customer_refund_processed',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY is not set');

    const resend = new Resend(resendApiKey);

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

    // Fetch return + order + tenant + items
    const { data: ret, error: retError } = await supabase
      .from('returns')
      .select(`
        id, rma_number, refund_amount, refund_method,
        orders!returns_order_id_fkey(
          order_number, customer_email, customer_name,
          shipping_address, total, currency, locale,
          tenant_id,
          tenants(name, support_email, contact_email)
        ),
        return_items(product_name, quantity)
      `)
      .eq('id', return_id)
      .single();

    if (retError || !ret) {
      log('Return not found', { retError });
      throw new Error('Return niet gevonden');
    }

    const order = ret.orders as any;
    if (!order) throw new Error('Order niet gevonden bij retour');

    const tenant = order.tenants as any;
    const tenantId = order.tenant_id;

    // Check notification settings
    const { data: settings } = await supabase
      .from('tenant_return_settings')
      .select('notify_customer_request_received, notify_customer_approved, notify_customer_package_received, notify_customer_refund_processed, notify_admin_new_request')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const settingKey = SETTING_KEY[event as ReturnEmailEvent];
    // Default to true if no settings row exists
    if (settings && settings[settingKey] === false) {
      log('Notification disabled', { event, settingKey });
      return new Response(
        JSON.stringify({ skipped: true, reason: 'notification disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine recipient (all remaining events are customer-facing)
    const supportEmail = tenant?.support_email || tenant?.contact_email || 'admin@sellqo.app';
    const to = order.customer_email;

    if (!to) {
      log('No recipient email');
      return new Response(
        JSON.stringify({ skipped: true, reason: 'no recipient email' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve locale
    const locale: Locale = await resolveLocale(supabase, order, tenantId);

    log('Resolved locale', { locale, to });

    const items = (ret.return_items || []).map((i: any) => ({
      name: i.product_name || 'Onbekend product',
      quantity: i.quantity || 1,
    }));

    const templateData: TemplateData = {
      tenantName: tenant?.name || 'SellQo',
      customerName: order.customer_name || 'Klant',
      orderNumber: order.order_number || '-',
      rmaNumber: ret.rma_number || '-',
      refundAmountFormatted: formatAmount(ret.refund_amount || 0, order.currency || 'EUR', locale),
      refundMethod: ret.refund_method || 'manual',
      items,
      supportEmail,
    };

    const template = getTemplate(event as ReturnEmailEvent, locale, templateData);

    log('Sending email', { to, subject: template.subject });

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${tenant?.name || 'SellQo'} <retouren@sellqo.app>`,
      to: [to],
      subject: template.subject,
      html: template.html,
      reply_to: supportEmail !== 'admin@sellqo.app' ? supportEmail : undefined,
    });

    if (emailError) {
      log('Resend error', emailError);
      throw new Error(`Email verzenden mislukt: ${emailError.message}`);
    }

    log('Email sent', { id: emailData?.id });

    return new Response(
      JSON.stringify({ success: true, email_id: emailData?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    log('Error', { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
