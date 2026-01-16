import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PLATFORM-CHECKOUT] ${step}${detailsStr}`);
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logStep("Authentication failed", { error: authError?.message });
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get request body
    const { planId, interval } = await req.json();
    logStep("Request body", { planId, interval });

    if (!planId || !interval) {
      return new Response(JSON.stringify({ error: "Missing planId or interval" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Get tenant for user (via user_roles)
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!userRole?.tenant_id) {
      logStep("No tenant found for user");
      return new Response(JSON.stringify({ error: "Tenant not found" }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", userRole.tenant_id)
      .single();

    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    logStep("Tenant found", { tenantId: tenant.id, name: tenant.name });

    // Get pricing plan
    const { data: plan } = await supabase
      .from("pricing_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (!plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    logStep("Plan found", { planId: plan.id, name: plan.name });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get or create Stripe customer
    let stripeCustomerId = tenant.stripe_customer_id;

    if (!stripeCustomerId) {
      logStep("Creating new Stripe customer");
      const customer = await stripe.customers.create({
        email: tenant.billing_email || tenant.owner_email,
        name: tenant.billing_company_name || tenant.name,
        metadata: {
          tenantId: tenant.id,
          supabaseUserId: user.id,
        },
      });
      stripeCustomerId = customer.id;
      logStep("Stripe customer created", { customerId: stripeCustomerId });

      // Save to tenant
      await supabase
        .from("tenants")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", tenant.id);
    } else {
      logStep("Using existing Stripe customer", { customerId: stripeCustomerId });
    }

    // Determine price ID
    const priceId = interval === "yearly" 
      ? plan.stripe_price_id_yearly 
      : plan.stripe_price_id_monthly;

    if (!priceId) {
      logStep("No Stripe price configured for plan", { planId, interval });
      return new Response(JSON.stringify({ error: "Stripe price not configured for this plan" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Check if tenant already has a subscription
    const { data: existingSub } = await supabase
      .from("tenant_subscriptions")
      .select("stripe_subscription_id, status")
      .eq("tenant_id", tenant.id)
      .single();

    // If upgrading/changing existing active subscription, use Stripe billing portal
    if (existingSub?.stripe_subscription_id && existingSub.status === "active") {
      logStep("Redirecting to billing portal for plan change");
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${req.headers.get("origin")}/admin/billing`,
      });
      return new Response(JSON.stringify({ url: portalSession.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Checkout Session for new subscription
    logStep("Creating checkout session", { priceId });
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card", "bancontact", "ideal"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${req.headers.get("origin")}/admin/billing?success=true`,
      cancel_url: `${req.headers.get("origin")}/pricing?canceled=true`,
      subscription_data: {
        metadata: {
          tenantId: tenant.id,
          planId: plan.id,
        },
      },
      tax_id_collection: {
        enabled: true,
      },
      customer_update: {
        address: "auto",
        name: "auto",
      },
      billing_address_collection: "required",
      allow_promotion_codes: true,
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
