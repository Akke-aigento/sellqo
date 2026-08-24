// SUB-2: Create a mandate setup link for a customer.
// Deploy marker: 2026-07-08 re-deploy trigger.
// Admin/staff triggers this; returns a URL the customer visits once to
// authorize SEPA Direct Debit or card off-session charging.
//
// BILL-1: the minting itself moved to _shared/mandateToken.ts so the dunning
// runner can mint the same link server-side. This function is now the
// authenticated wrapper around it: it resolves customer + tenant, checks the
// role, and passes the request origin through as the preferred base URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { getStripeContext } from "../_shared/stripe.ts";
import { mintMandateSetupLink } from "../_shared/mandateToken.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const suffix = details !== undefined ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-MANDATE-SETUP] ${step}${suffix}`);
};

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
    const subscriptionId = typeof body?.subscription_id === "string" && body.subscription_id
      ? body.subscription_id
      : null;
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
      .select("id, name, is_demo, is_internal_tenant, stripe_account_id")
      .eq("id", customer.tenant_id)
      .maybeSingle();
    if (tenantErr) throw tenantErr;
    if (!tenant) throw new Error("Tenant not found");

    const ctx = getStripeContext(tenant);

    // Origin stays the first choice: an admin on a preview or custom domain
    // keeps getting exactly the link they got before this change. Only when it
    // is absent does PUBLIC_APP_URL step in — and there the old result was a
    // relative, unusable path.
    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || null;

    const { token, url } = await mintMandateSetupLink(supabase, ctx, {
      tenant,
      customer,
      subscriptionId,
      baseUrl: origin,
    });

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
