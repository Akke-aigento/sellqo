import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeForTenant } from "../_shared/stripe.ts";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HARDE VEILIGHEIDSGRENS: deze functie mag UITSLUITEND op VanXcel werken.
const VANXCEL_TENANT_ID = "54f6b480-280b-42e1-b843-d5beb2831acd";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { tenant_id, do_request } = await req.json();
    if (!tenant_id) throw new Error("tenant_id is required");

    if (tenant_id !== VANXCEL_TENANT_ID) {
      throw new Error("Deze recon-functie werkt uitsluitend op VanXcel.");
    }

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

    let capabilityBefore: any = null;
    let readError: string | null = null;
    try {
      capabilityBefore = await stripe.accounts.retrieveCapability(
        tenantData.stripe_account_id,
        "paypal_payments"
      );
    } catch (e: any) {
      readError = e?.message ?? String(e);
    }

    let requestResult: any = null;
    let requestError: string | null = null;
    let didRequest = false;
    if (do_request === true) {
      didRequest = true;
      try {
        requestResult = await stripe.accounts.updateCapability(
          tenantData.stripe_account_id,
          "paypal_payments",
          { requested: true }
        );
      } catch (e: any) {
        requestError = e?.message ?? String(e);
      }
    }

    let capabilityAfter: any = null;
    try {
      capabilityAfter = await stripe.accounts.retrieveCapability(
        tenantData.stripe_account_id,
        "paypal_payments"
      );
    } catch (e: any) {
      // stil — capabilityBefore/readError dekt dit al
    }

    return new Response(JSON.stringify({
      tenant: tenantData.name,
      stripe_account_id: tenantData.stripe_account_id,
      did_request: didRequest,
      capability_before: capabilityBefore,
      read_error: readError,
      request_result: requestResult,
      request_error: requestError,
      capability_after: capabilityAfter,
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
