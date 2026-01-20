import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Niet geautoriseerd");
    }

    const { amount, currency = "eur", terminal_id, tenant_id, metadata } = await req.json();

    if (!amount || amount <= 0) {
      throw new Error("Ongeldig bedrag");
    }

    // Get tenant's Stripe Connect account
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("stripe_account_id, stripe_charges_enabled")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error("Tenant niet gevonden");
    }

    if (!tenant.stripe_account_id || !tenant.stripe_charges_enabled) {
      throw new Error("Stripe account niet actief. Configureer eerst Stripe in instellingen.");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Create payment intent on the connected account
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      metadata: {
        terminal_id,
        tenant_id,
        ...metadata,
      },
    }, {
      stripeAccount: tenant.stripe_account_id,
    });

    console.log("[POS] Payment intent created:", paymentIntent.id);

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("[POS] Error creating payment intent:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
