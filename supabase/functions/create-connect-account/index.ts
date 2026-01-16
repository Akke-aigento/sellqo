import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CONNECT-ACCOUNT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get request body
    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id is required");
    logStep("Tenant ID received", { tenant_id });

    // Verify user has access to this tenant
    const { data: tenantData, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("id, name, owner_email, stripe_account_id")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenantData) {
      throw new Error("Tenant not found or access denied");
    }
    logStep("Tenant found", { tenantName: tenantData.name });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if tenant already has a Stripe account
    if (tenantData.stripe_account_id) {
      logStep("Tenant already has Stripe account, creating new onboarding link");
      
      const accountLink = await stripe.accountLinks.create({
        account: tenantData.stripe_account_id,
        refresh_url: `${req.headers.get("origin")}/admin/settings?stripe=refresh`,
        return_url: `${req.headers.get("origin")}/admin/settings?stripe=success`,
        type: "account_onboarding",
      });

      return new Response(JSON.stringify({ 
        url: accountLink.url,
        account_id: tenantData.stripe_account_id 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create new Stripe Express account
    logStep("Creating new Stripe Express account");
    let account;
    try {
      account = await stripe.accounts.create({
        type: "express",
        country: "NL",
        email: tenantData.owner_email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
          ideal_payments: { requested: true },
          bancontact_payments: { requested: true },
        },
        business_type: "individual",
        metadata: {
          tenant_id: tenant_id,
          tenant_name: tenantData.name,
        },
      });
      logStep("Stripe account created", { accountId: account.id });
    } catch (stripeError: any) {
      logStep("Stripe account creation failed", { error: stripeError.message });
      // Provide helpful error message for Connect not enabled
      if (stripeError.message?.includes("signed up for Connect")) {
        throw new Error("Stripe Connect is niet geactiveerd. Ga naar je Stripe Dashboard > Settings > Connect om dit te activeren.");
      }
      throw new Error(`Stripe fout: ${stripeError.message}`);
    }

    // Update tenant with Stripe account ID
    const { error: updateError } = await supabaseClient
      .from("tenants")
      .update({ 
        stripe_account_id: account.id,
        stripe_onboarding_complete: false,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
      })
      .eq("id", tenant_id);

    if (updateError) {
      logStep("Error updating tenant", { error: updateError.message });
      throw new Error(`Failed to update tenant: ${updateError.message}`);
    }
    logStep("Tenant updated with Stripe account ID");

    // Create account onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${req.headers.get("origin")}/admin/settings?stripe=refresh`,
      return_url: `${req.headers.get("origin")}/admin/settings?stripe=success`,
      type: "account_onboarding",
    });
    logStep("Account link created", { url: accountLink.url });

    return new Response(JSON.stringify({ 
      url: accountLink.url,
      account_id: account.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
