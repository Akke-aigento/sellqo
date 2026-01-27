import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }
    logStep("User authenticated", { userId: userData.user.id });

    // Get tenant_id from request
    const { tenant_id } = await req.json();
    if (!tenant_id) {
      throw new Error("tenant_id is required");
    }
    logStep("Tenant ID received", { tenant_id });

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

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

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
