import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CALCULATE-PLAN-SWITCH] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { target_plan_id, target_interval } = await req.json();
    if (!target_plan_id) throw new Error("target_plan_id is required");
    logStep("Request params", { target_plan_id, target_interval });

    // Get user's tenant
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!userRole?.tenant_id) {
      throw new Error("No tenant found for user");
    }
    logStep("Tenant found", { tenantId: userRole.tenant_id });

    // Get current subscription
    const { data: currentSub } = await supabase
      .from("tenant_subscriptions")
      .select("*, pricing_plan:pricing_plans(*)")
      .eq("tenant_id", userRole.tenant_id)
      .eq("status", "active")
      .single();

    if (!currentSub?.stripe_subscription_id) {
      throw new Error("No active Stripe subscription found");
    }
    logStep("Current subscription", { subId: currentSub.stripe_subscription_id });

    // Get target plan
    const { data: targetPlan } = await supabase
      .from("pricing_plans")
      .select("*")
      .eq("id", target_plan_id)
      .single();

    if (!targetPlan) {
      throw new Error("Target plan not found");
    }
    logStep("Target plan", { name: targetPlan.name });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Determine new price ID
    const newInterval = target_interval || currentSub.billing_interval || "monthly";
    const newPriceId = newInterval === "yearly" 
      ? targetPlan.stripe_price_id_yearly 
      : targetPlan.stripe_price_id_monthly;

    if (!newPriceId) {
      throw new Error(`No Stripe price ID found for ${newInterval} billing`);
    }

    // Get current subscription from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      currentSub.stripe_subscription_id
    );
    logStep("Stripe subscription retrieved", { status: stripeSubscription.status });

    // Calculate proration preview using upcoming invoice
    const currentItemId = stripeSubscription.items.data[0]?.id;
    if (!currentItemId) {
      throw new Error("No subscription item found");
    }

    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      customer: stripeSubscription.customer as string,
      subscription: currentSub.stripe_subscription_id,
      subscription_items: [
        {
          id: currentItemId,
          price: newPriceId,
        },
      ],
      subscription_proration_behavior: "create_prorations",
    });
    logStep("Upcoming invoice calculated", { 
      total: upcomingInvoice.total,
      subtotal: upcomingInvoice.subtotal 
    });

    // Calculate values
    const currentPlan = currentSub.pricing_plan;
    const currentPrice = currentSub.billing_interval === "yearly" 
      ? (currentPlan?.yearly_price || 0) 
      : (currentPlan?.monthly_price || 0);
    const newPrice = newInterval === "yearly" 
      ? targetPlan.yearly_price 
      : targetPlan.monthly_price;

    // Calculate remaining days and credit
    const periodEnd = new Date(currentSub.current_period_end!);
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const totalDays = currentSub.billing_interval === "yearly" ? 365 : 30;
    const unusedCredit = (currentPrice / totalDays) * daysRemaining;

    // Determine add-ons that will be migrated (included in new plan)
    const { data: activeAddons } = await supabase
      .from("tenant_addons")
      .select("*")
      .eq("tenant_id", userRole.tenant_id)
      .eq("status", "active");

    const addonsToMigrate = (activeAddons || []).filter(addon => {
      // Check if addon feature is included in target plan
      const featureKey = addon.addon_type.replace('_addon', '');
      const targetFeatures = targetPlan.features as Record<string, boolean>;
      return targetFeatures?.[featureKey] === true;
    });

    const addonSavings = addonsToMigrate.reduce((sum, addon) => 
      sum + (addon.price_monthly || 0), 0
    );

    // Determine features gained/lost
    const currentFeatures = (currentPlan?.features || {}) as Record<string, boolean>;
    const targetFeatures = (targetPlan.features || {}) as Record<string, boolean>;

    const featuresGained: string[] = [];
    const featuresLost: string[] = [];

    Object.keys(targetFeatures).forEach(key => {
      if (targetFeatures[key] && !currentFeatures[key]) {
        featuresGained.push(key);
      }
    });

    Object.keys(currentFeatures).forEach(key => {
      if (currentFeatures[key] && !targetFeatures[key]) {
        featuresLost.push(key);
      }
    });

    const isUpgrade = newPrice > currentPrice;

    const result = {
      current_plan: {
        id: currentPlan?.id,
        name: currentPlan?.name,
        price: currentPrice,
        interval: currentSub.billing_interval,
      },
      target_plan: {
        id: targetPlan.id,
        name: targetPlan.name,
        price: newPrice,
        interval: newInterval,
      },
      proration: {
        days_remaining: daysRemaining,
        unused_credit: Math.round(unusedCredit * 100) / 100,
        amount_due_now: upcomingInvoice.total / 100,
        next_invoice_date: new Date(upcomingInvoice.period_end * 1000).toISOString(),
      },
      addons: {
        to_migrate: addonsToMigrate.map(a => ({
          id: a.id,
          type: a.addon_type,
          monthly_price: a.price_monthly,
        })),
        monthly_savings: addonSavings,
      },
      features: {
        gained: featuresGained,
        lost: featuresLost,
      },
      is_upgrade: isUpgrade,
      stripe_preview: {
        subtotal: upcomingInvoice.subtotal / 100,
        tax: (upcomingInvoice.tax || 0) / 100,
        total: upcomingInvoice.total / 100,
        currency: upcomingInvoice.currency,
      },
    };

    logStep("Calculation complete", { isUpgrade, amountDue: result.proration.amount_due_now });

    return new Response(JSON.stringify(result), {
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
