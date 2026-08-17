import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeForTenant } from "../_shared/stripe.ts";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id is required");

    const auth = await authenticateRequest(req, tenant_id);
    requireRole(auth, tenant_id, ['tenant_admin']);

    const { data: tenantData, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("stripe_account_id, name")
      .eq("id", tenant_id)
      .single();
    if (tenantError || !tenantData?.stripe_account_id) {
      throw new Error("Tenant heeft geen Stripe-account");
    }

    const { stripe } = await getStripeForTenant(supabaseClient, tenant_id);

    let paypalCapability: any = null;
    let capabilityError: string | null = null;
    try {
      paypalCapability = await stripe.accounts.retrieveCapability(
        tenantData.stripe_account_id,
        "paypal_payments"
      );
    } catch (e: any) {
      capabilityError = e?.message ?? String(e);
    }

    let allCapabilities: any = null;
    try {
      const account = await stripe.accounts.retrieve(tenantData.stripe_account_id);
      allCapabilities = account.capabilities ?? null;
    } catch (e: any) {
      // stil — extra context
    }

    return new Response(JSON.stringify({
      tenant: tenantData.name,
      stripe_account_id: tenantData.stripe_account_id,
      paypal_capability: paypalCapability,
      paypal_capability_error: capabilityError,
      all_capabilities: allCapabilities,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
