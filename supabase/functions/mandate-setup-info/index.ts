// SUB-2: Public endpoint — returns SetupIntent client_secret + customer/tenant
// Deploy marker: 2026-07-08 re-deploy trigger.
// info for a mandate setup token. NO auth (customer clicks a link).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeContext } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MANDATE-SETUP-INFO] ${step}${suffix}`);
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
    if (typeof token !== "string" || !token) {
      return new Response(
        JSON.stringify({ success: false, error: "token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: tok, error: tokErr } = await supabase
      .from("mandate_setup_tokens")
      .select("id, tenant_id, customer_id, expires_at, used_at, stripe_customer_id, context")
      .eq("token", token)
      .maybeSingle();
    if (tokErr) throw tokErr;
    if (!tok) {
      return new Response(
        JSON.stringify({ success: false, error: "invalid_token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (tok.used_at) {
      return new Response(
        JSON.stringify({ success: false, error: "token_used" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (new Date(tok.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "token_expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!tok.stripe_customer_id) {
      throw new Error("Token missing stripe_customer_id");
    }

    const [{ data: tenant, error: tErr }, { data: customer, error: cErr }] = await Promise.all([
      supabase
        .from("tenants")
        .select("id, name, is_demo, is_internal_tenant, stripe_account_id, primary_color")
        .eq("id", tok.tenant_id)
        .maybeSingle(),
      supabase
        .from("customers")
        .select("id, email, first_name, last_name, company_name")
        .eq("id", tok.customer_id)
        .maybeSingle(),
    ]);
    if (tErr) throw tErr;
    if (cErr) throw cErr;
    if (!tenant || !customer) throw new Error("Tenant or customer not found");

    const ctx = getStripeContext(tenant);
    const setupIntent = await ctx.stripe.setupIntents.create(
      {
        customer: tok.stripe_customer_id,
        payment_method_types: ["sepa_debit", "card"],
        usage: "off_session",
        metadata: {
          tenant_id: tenant.id,
          customer_id: customer.id,
          mandate_token_id: tok.id,
        },
      },
      ctx.requestOptions,
    );

    const publishableKey = tenant.is_demo
      ? Deno.env.get("STRIPE_TEST_PUBLISHABLE_KEY") || Deno.env.get("STRIPE_PUBLISHABLE_KEY")
      : Deno.env.get("STRIPE_PUBLISHABLE_KEY");
    if (!publishableKey) {
      throw new Error("STRIPE_PUBLISHABLE_KEY is not set");
    }

    log("SetupIntent created", { token, setupIntentId: setupIntent.id });

    return new Response(
      JSON.stringify({
        success: true,
        client_secret: setupIntent.client_secret,
        publishable_key: publishableKey,
        stripe_account: ctx.onPlatformAccount ? null : tenant.stripe_account_id,
        tenant: { id: tenant.id, name: tenant.name, primary_color: tenant.primary_color },
        // UX-UNIFY-1: optional plan context (null for classic tenant→customer mandates)
        context: (tok as any).context ?? null,
        customer: {
          id: customer.id,
          email: customer.email,
          name:
            customer.company_name ||
            [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
            customer.email,
        },
      }),
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