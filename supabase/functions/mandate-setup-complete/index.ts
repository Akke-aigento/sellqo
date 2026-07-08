// SUB-2: Public endpoint — finalizes a mandate after Stripe Elements has
// confirmed the SetupIntent client-side. Upserts customer_payment_mandates
// and marks the token used. NO auth.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeContext } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MANDATE-SETUP-COMPLETE] ${step}${suffix}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token;
    const setupIntentId = body?.setup_intent_id;
    if (typeof token !== "string" || !token || typeof setupIntentId !== "string" || !setupIntentId) {
      return new Response(
        JSON.stringify({ success: false, error: "token and setup_intent_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: tok, error: tokErr } = await supabase
      .from("mandate_setup_tokens")
      .select("id, tenant_id, customer_id, expires_at, used_at, stripe_customer_id")
      .eq("token", token)
      .maybeSingle();
    if (tokErr) throw tokErr;
    if (!tok) throw new Error("Invalid token");
    if (tok.used_at) throw new Error("Token already used");
    if (new Date(tok.expires_at) < new Date()) throw new Error("Token expired");

    const { data: tenant, error: tErr } = await supabase
      .from("tenants")
      .select("id, is_demo, is_internal_tenant, stripe_account_id")
      .eq("id", tok.tenant_id)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!tenant) throw new Error("Tenant not found");

    const ctx = getStripeContext(tenant);
    const setupIntent = await ctx.stripe.setupIntents.retrieve(setupIntentId, ctx.requestOptions);
    if (setupIntent.status !== "succeeded" && setupIntent.status !== "processing") {
      throw new Error(`SetupIntent not in a completing state: ${setupIntent.status}`);
    }
    if (setupIntent.metadata?.mandate_token_id !== tok.id) {
      throw new Error("SetupIntent does not match token");
    }

    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;
    if (!paymentMethodId) throw new Error("SetupIntent has no payment_method");

    const pm = await ctx.stripe.paymentMethods.retrieve(paymentMethodId, ctx.requestOptions);
    const methodType = pm.type === "card" ? "card" : "sepa_debit";

    const { error: mErr } = await supabase
      .from("customer_payment_mandates")
      .upsert(
        {
          tenant_id: tok.tenant_id,
          customer_id: tok.customer_id,
          stripe_customer_id: tok.stripe_customer_id!,
          stripe_payment_method_id: paymentMethodId,
          method_type: methodType,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,customer_id" },
      );
    if (mErr) throw mErr;

    await supabase
      .from("mandate_setup_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tok.id);

    log("Mandate activated", {
      tenant: tok.tenant_id,
      customer: tok.customer_id,
      method: methodType,
    });

    return new Response(
      JSON.stringify({ success: true, method_type: methodType }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR", { message });
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});