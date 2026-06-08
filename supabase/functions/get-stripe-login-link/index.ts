import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getStripeForTenant } from "../_shared/stripe.ts";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-STRIPE-LOGIN-LINK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get tenant_id from request
    const { tenant_id } = await req.json();
    if (!tenant_id) {
      throw new Error("tenant_id is required");
    }
    logStep("Tenant ID received", { tenant_id });

    // Authenticate user + role check (Batch 2B1b)
    const auth = await authenticateRequest(req, tenant_id);
    requireRole(auth, tenant_id, ['tenant_admin']);
    logStep("User authenticated", { userId: auth.user_id });

    // Get tenant's Stripe account ID
    const { data: tenantData, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("stripe_account_id, name")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenantData) {
      throw new Error("Tenant not found");
    }
    logStep("Tenant found", { tenantName: tenantData.name });

    if (!tenantData.stripe_account_id) {
      throw new Error("Tenant has no Stripe account configured");
    }

    const { stripe, keyMode } = await getStripeForTenant(supabaseClient, tenant_id);
    logStep("Stripe client initialised", { keyMode });

    // Create login link for the Express account
    logStep("Creating login link for account", { accountId: tenantData.stripe_account_id });
    const loginLink = await stripe.accounts.createLoginLink(tenantData.stripe_account_id);
    logStep("Login link created successfully");

    return new Response(
      JSON.stringify({ url: loginLink.url }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
