import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import type Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeForTenant } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-MERCHANT-PAYOUTS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Request received");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    logStep("User authenticated", { userId: user.id });

    // Get user's tenant with stripe account
    const { data: userRole } = await supabaseClient
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!userRole?.tenant_id) {
      throw new Error("No tenant found for user");
    }

    const { data: tenant } = await supabaseClient
      .from("tenants")
      .select("stripe_account_id")
      .eq("id", userRole.tenant_id)
      .single();

    if (!tenant?.stripe_account_id) {
      return new Response(JSON.stringify({ 
        payouts: [],
        has_more: false,
        message: "No Stripe account connected" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { stripe, keyMode } = await getStripeForTenant(supabaseClient, userRole.tenant_id);
    logStep("Stripe client initialised", { keyMode });

    logStep("Fetching payouts for Stripe account", { accountId: tenant.stripe_account_id });

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const startingAfter = url.searchParams.get("starting_after") || undefined;

    // Fetch payouts from merchant's Stripe account
    const params: Stripe.PayoutListParams = { limit };
    if (startingAfter) params.starting_after = startingAfter;

    const payouts = await stripe.payouts.list(params, {
      stripeAccount: tenant.stripe_account_id,
    });

    logStep("Payouts fetched", { count: payouts.data.length });

    // Transform to simpler format
    const formattedPayouts = payouts.data.map((payout: Stripe.Payout) => ({
      id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      type: payout.type,
      method: payout.method,
      arrival_date: payout.arrival_date,
      created: payout.created,
      description: payout.description,
      failure_message: payout.failure_message,
    }));

    // Get account info for next scheduled payout
    const account = await stripe.accounts.retrieve(tenant.stripe_account_id);
    
    let nextPayoutDate = null;
    if (account.settings?.payouts?.schedule) {
      const schedule = account.settings.payouts.schedule;
      nextPayoutDate = {
        interval: schedule.interval,
        delay_days: schedule.delay_days,
        weekly_anchor: schedule.weekly_anchor,
        monthly_anchor: schedule.monthly_anchor,
      };
    }

    return new Response(JSON.stringify({ 
      payouts: formattedPayouts,
      has_more: payouts.has_more,
      schedule: nextPayoutDate,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    });
  }
});
