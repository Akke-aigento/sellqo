// SUB-2: Create a mandate setup link for a customer.
// Deploy marker: 2026-07-08 re-deploy trigger.
// Admin/staff triggers this; returns a URL the customer visits once to
// authorize SEPA Direct Debit or card off-session charging.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { getStripeContext } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-MANDATE-SETUP] ${step}${suffix}`);
};

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json().catch(() => ({}));
    const customerId = body?.customer_id;
    if (typeof customerId !== "string" || !customerId) {
      return new Response(
        JSON.stringify({ success: false, error: "customer_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load customer + tenant
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("id, tenant_id, email, first_name, last_name, company_name")
      .eq("id", customerId)
      .maybeSingle();
    if (custErr) throw custErr;
    if (!customer) throw new Error("Customer not found");

    const auth = await authenticateRequest(req, customer.tenant_id);
    requireRole(auth, customer.tenant_id, ["tenant_admin", "staff"]);

    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("id, is_demo, is_internal_tenant, stripe_account_id")
      .eq("id", customer.tenant_id)
      .maybeSingle();
    if (tenantErr) throw tenantErr;
    if (!tenant) throw new Error("Tenant not found");

    const ctx = getStripeContext(tenant);

    // Reuse an existing Stripe customer if we already stored one for a
    // previous (revoked/failed) mandate; otherwise create a fresh one.
    let stripeCustomerId: string | null = null;
    const { data: existingMandate } = await supabase
      .from("customer_payment_mandates")
      .select("stripe_customer_id")
      .eq("tenant_id", tenant.id)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (existingMandate?.stripe_customer_id) {
      stripeCustomerId = existingMandate.stripe_customer_id;
    }

    if (!stripeCustomerId) {
      const displayName =
        customer.company_name ||
        [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
        customer.email ||
        undefined;
      const stripeCustomer = await ctx.stripe.customers.create(
        {
          email: customer.email ?? undefined,
          name: displayName,
          metadata: { tenant_id: tenant.id, customer_id: customer.id },
        },
        ctx.requestOptions,
      );
      stripeCustomerId = stripeCustomer.id;
      log("Created Stripe customer", { stripeCustomerId, onPlatform: ctx.onPlatformAccount });
    }

    // Mint a fresh single-use token
    const token = randomToken();
    const { error: tokErr } = await supabase.from("mandate_setup_tokens").insert({
      tenant_id: tenant.id,
      customer_id: customer.id,
      token,
      stripe_customer_id: stripeCustomerId,
    });
    if (tokErr) throw tokErr;

    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "";
    const url = `${origin}/betaling/machtiging/${token}`;
    log("Mandate token created", { customerId: customer.id, tenant: tenant.id });

    return new Response(
      JSON.stringify({ success: true, token, url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR", { message });
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});