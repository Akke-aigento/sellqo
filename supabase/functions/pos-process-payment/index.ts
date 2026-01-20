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

    const { payment_intent_id, reader_id, tenant_id } = await req.json();

    if (!payment_intent_id) {
      throw new Error("Payment intent ID is vereist");
    }

    // Get tenant's Stripe Connect account
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("stripe_account_id")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant?.stripe_account_id) {
      throw new Error("Tenant Stripe account niet gevonden");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // If a reader is specified, process the payment on the terminal
    if (reader_id) {
      const processResult = await stripe.terminal.readers.processPaymentIntent(
        reader_id,
        { payment_intent: payment_intent_id },
        { stripeAccount: tenant.stripe_account_id }
      );

      console.log("[POS] Payment processing on reader:", processResult.id);

      return new Response(
        JSON.stringify({
          status: "processing",
          reader_id: processResult.id,
          action: processResult.action,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Otherwise just return the payment intent status
    const paymentIntent = await stripe.paymentIntents.retrieve(
      payment_intent_id,
      { stripeAccount: tenant.stripe_account_id }
    );

    return new Response(
      JSON.stringify({
        status: paymentIntent.status,
        payment_intent: {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("[POS] Error processing payment:", error);
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
