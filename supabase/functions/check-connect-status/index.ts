import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-CONNECT-STATUS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

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

    // Get tenant data
    const { data: tenantData, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenantData) {
      throw new Error("Tenant not found");
    }

    // If no Stripe account, return not configured status
    if (!tenantData.stripe_account_id) {
      logStep("No Stripe account configured");
      return new Response(JSON.stringify({
        configured: false,
        onboarding_complete: false,
        charges_enabled: false,
        payouts_enabled: false,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Fetch current status from Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const account = await stripe.accounts.retrieve(tenantData.stripe_account_id);
    logStep("Stripe account retrieved", { 
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted
    });

    // Update tenant with current status from Stripe
    const newStatus = {
      stripe_onboarding_complete: account.details_submitted || false,
      stripe_charges_enabled: account.charges_enabled || false,
      stripe_payouts_enabled: account.payouts_enabled || false,
    };

    // Only update if status changed
    if (
      newStatus.stripe_onboarding_complete !== tenantData.stripe_onboarding_complete ||
      newStatus.stripe_charges_enabled !== tenantData.stripe_charges_enabled ||
      newStatus.stripe_payouts_enabled !== tenantData.stripe_payouts_enabled
    ) {
      await supabaseClient
        .from("tenants")
        .update(newStatus)
        .eq("id", tenant_id);
      logStep("Tenant status updated in database");
    }

    // Fetch payout schedule and balance if account is active
    let payoutSchedule = null;
    let balance = null;
    let upcomingPayout = null;

    if (account.charges_enabled && account.payouts_enabled) {
      try {
        // Get balance
        const balanceData = await stripe.balance.retrieve({
          stripeAccount: tenantData.stripe_account_id,
        });
        
        const availableBalance = balanceData.available?.[0];
        const pendingBalance = balanceData.pending?.[0];
        
        balance = {
          available: availableBalance?.amount || 0,
          pending: pendingBalance?.amount || 0,
          currency: availableBalance?.currency || pendingBalance?.currency || 'eur',
        };
        logStep("Balance retrieved", balance);

        // Get payout schedule from account settings
        if (account.settings?.payouts?.schedule) {
          const schedule = account.settings.payouts.schedule;
          payoutSchedule = {
            interval: schedule.interval,
            delay_days: schedule.delay_days,
            weekly_anchor: schedule.weekly_anchor,
            monthly_anchor: schedule.monthly_anchor,
          };
          logStep("Payout schedule retrieved", payoutSchedule);
        }

        // Get next scheduled payout if any balance available
        if (balance.available > 0) {
          const payouts = await stripe.payouts.list({
            limit: 1,
            status: 'pending',
          }, {
            stripeAccount: tenantData.stripe_account_id,
          });
          
          if (payouts.data.length > 0) {
            upcomingPayout = {
              amount: payouts.data[0].amount,
              currency: payouts.data[0].currency,
              arrival_date: payouts.data[0].arrival_date,
            };
            logStep("Upcoming payout found", upcomingPayout);
          }
        }
      } catch (balanceError) {
        logStep("Could not fetch balance/schedule", { error: String(balanceError) });
      }
    }

    return new Response(JSON.stringify({
      configured: true,
      account_id: account.id,
      onboarding_complete: account.details_submitted || false,
      charges_enabled: account.charges_enabled || false,
      payouts_enabled: account.payouts_enabled || false,
      requirements: account.requirements,
      payout_schedule: payoutSchedule,
      balance: balance,
      upcoming_payout: upcomingPayout,
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
