import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeContext } from "../_shared/stripe.ts";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-INV-PAYLINK] ${step}${suffix}`);
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : (typeof e === 'string' ? e : JSON.stringify(e)));

// Idempotent: returns the existing checkout session URL when it was created
// within the past 24h and is still open. Otherwise creates a new one.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const invoiceId = body?.invoice_id;
    if (!invoiceId || typeof invoiceId !== 'string') {
      return new Response(JSON.stringify({ error: 'invoice_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, tenant_id, customer_id, invoice_number, total, status, checkout_session_id, checkout_session_url, checkout_session_created_at')
      .eq('id', invoiceId)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!invoice) throw new Error('Invoice not found');
    // AUTH-TRIAGE-2 — resolve-then-authorize. Hier stond niets: wie een
    // `invoice_id` had, kon deze functie laten draaien. Een UUID is onraadbaar
    // maar geen autorisatie. De factuur is hierboven opgehaald om de tenant te
    // kennen; nu pas wordt de aanroeper getoetst. Interne aanroepers gebruiken
    // een service-role-client en komen er doorheen (_shared/auth.ts:48-56).
    await authenticateRequest(req, invoice.tenant_id);

    // Reuse recent session (<24h) if still openable
    const ageMs = invoice.checkout_session_created_at
      ? Date.now() - new Date(invoice.checkout_session_created_at).getTime()
      : Infinity;
    if (invoice.checkout_session_url && ageMs < 24 * 60 * 60 * 1000) {
      log('Reusing existing session', { invoice_id: invoiceId, age_hours: (ageMs / 3600000).toFixed(1) });
      return new Response(JSON.stringify({
        success: true,
        checkout_url: invoice.checkout_session_url,
        checkout_session_id: invoice.checkout_session_id,
        reused: true,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('id, name, is_demo, is_internal_tenant, stripe_account_id, billing_email, owner_email, currency')
      .eq('id', invoice.tenant_id)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!tenant) throw new Error('Tenant not found');

    let customerEmail: string | null = null;
    if (invoice.customer_id) {
      const { data: cust } = await supabase
        .from('customers')
        .select('email')
        .eq('id', invoice.customer_id)
        .maybeSingle();
      customerEmail = cust?.email ?? null;
    }

    const ctx = getStripeContext(tenant);
    const amountCents = Math.round(Number(invoice.total) * 100);
    const currency = (tenant as any).currency?.toLowerCase?.() || 'eur';
    const publicUrl = Deno.env.get('PUBLIC_APP_URL') || 'https://sellqo.app';

    const session = await ctx.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'ideal', 'bancontact', 'sepa_debit'],
      customer_email: customerEmail || undefined,
      line_items: [{
        price_data: {
          currency,
          product_data: { name: `Factuur ${invoice.invoice_number}` },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      success_url: `${publicUrl}/pay/success?invoice=${invoice.invoice_number}`,
      cancel_url: `${publicUrl}/pay/cancelled?invoice=${invoice.invoice_number}`,
      metadata: {
        invoice_id: invoice.id,
        tenant_id: invoice.tenant_id,
        invoice_number: invoice.invoice_number,
      },
      payment_intent_data: {
        metadata: {
          invoice_id: invoice.id,
          tenant_id: invoice.tenant_id,
        },
      },
    }, ctx.requestOptions);

    await supabase
      .from('invoices')
      .update({
        checkout_session_id: session.id,
        checkout_session_url: session.url,
        checkout_session_created_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    log('Session created', { invoice_id: invoiceId, session_id: session.id });
    return new Response(JSON.stringify({
      success: true,
      checkout_url: session.url,
      checkout_session_id: session.id,
      reused: false,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    // AuthError eerst: anders wordt een 401 een 500.
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const message = errMsg(err);
    console.error('[CREATE-INV-PAYLINK] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});