// CYCLE-2: Stripe Checkout one-off payment link for a pay-first billing cycle.
// Idempotent: reuses a session created within the past 24h.
// The session sets payment_intent_data.metadata so the resulting
// payment_intent.succeeded event carries billing_cycle_id and the existing
// CYCLE-3 handler settles the cycle — no checkout.session.completed handler.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeContext } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CYCLE-PAYLINK] ${step}${suffix}`);
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : (typeof e === "string" ? e : JSON.stringify(e)));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const cycleId = body?.billing_cycle_id;
    if (!cycleId || typeof cycleId !== "string") {
      return new Response(JSON.stringify({ error: "billing_cycle_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cycle, error: cErr } = await supabase
      .from("billing_cycles")
      .select("id, tenant_id, customer_id, total, status, invoice_id, payment_request_number, checkout_session_id, checkout_session_url, checkout_session_created_at")
      .eq("id", cycleId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!cycle) throw new Error("Billing cycle not found");

    const ageMs = cycle.checkout_session_created_at
      ? Date.now() - new Date(cycle.checkout_session_created_at).getTime()
      : Infinity;
    if (cycle.checkout_session_url && ageMs < 24 * 60 * 60 * 1000) {
      log("Reusing existing session", { billing_cycle_id: cycleId, age_hours: (ageMs / 3600000).toFixed(1) });
      return new Response(JSON.stringify({
        success: true,
        checkout_url: cycle.checkout_session_url,
        checkout_session_id: cycle.checkout_session_id,
        reused: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: tenant, error: tErr } = await supabase
      .from("tenants")
      .select("id, name, is_demo, is_internal_tenant, stripe_account_id, currency")
      .eq("id", cycle.tenant_id)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!tenant) throw new Error("Tenant not found");

    let customerEmail: string | null = null;
    if (cycle.customer_id) {
      const { data: cust } = await supabase
        .from("customers").select("email").eq("id", cycle.customer_id).maybeSingle();
      customerEmail = cust?.email ?? null;
    }

    const ctx = getStripeContext(tenant);
    const amountCents = Math.round(Number(cycle.total) * 100);
    const currency = (tenant as any).currency?.toLowerCase?.() || "eur";
    const publicUrl = Deno.env.get("PUBLIC_APP_URL") || "https://sellqo.app";
    const prNumber = cycle.payment_request_number ? String(cycle.payment_request_number) : cycle.id;

    // No payment_method_types: Stripe automatically offers card, Bancontact,
    // iDEAL and wallets based on the account's enabled methods.
    const session = await ctx.stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail || undefined,
      line_items: [{
        price_data: {
          currency,
          product_data: { name: `Betalingsverzoek ${prNumber}` },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      success_url: `${publicUrl}/pay/success?pr=${encodeURIComponent(prNumber)}`,
      cancel_url: `${publicUrl}/pay/cancelled?pr=${encodeURIComponent(prNumber)}`,
      metadata: {
        billing_cycle_id: cycle.id,
        tenant_id: cycle.tenant_id,
        payment_request_number: prNumber,
      },
      payment_intent_data: {
        metadata: {
          billing_cycle_id: cycle.id,
          tenant_id: cycle.tenant_id,
        },
      },
    }, ctx.requestOptions);

    const { error: updErr } = await supabase
      .from("billing_cycles")
      .update({
        checkout_session_id: session.id,
        checkout_session_url: session.url,
        checkout_session_created_at: new Date().toISOString(),
      })
      .eq("id", cycle.id)
      .select("id");
    if (updErr) throw updErr;

    log("Session created", { billing_cycle_id: cycleId, session_id: session.id });
    return new Response(JSON.stringify({
      success: true,
      checkout_url: session.url,
      checkout_session_id: session.id,
      reused: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = errMsg(err);
    console.error("[CREATE-CYCLE-PAYLINK] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});