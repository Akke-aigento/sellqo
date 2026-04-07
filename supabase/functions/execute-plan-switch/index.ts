import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[EXECUTE-PLAN-SWITCH] ${step}${detailsStr}`);
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

    const { target_plan_id, target_interval, tenant_id: bodyTenantId, proration_behavior = "create_prorations" } = await req.json();
    if (!target_plan_id) throw new Error("target_plan_id is required");
    logStep("Request params", { target_plan_id, target_interval, bodyTenantId, proration_behavior });

    // Get user's tenant - prefer explicit tenant_id from body
    let tenantId = bodyTenantId;
    if (!tenantId) {
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .not("tenant_id", "is", null)
        .limit(1)
        .maybeSingle();
      tenantId = userRole?.tenant_id;
    }

    if (!tenantId) {
      throw new Error("No tenant found for user");
    }
    logStep("Tenant found", { tenantId });

    // Get current subscription
    const { data: currentSub } = await supabase
      .from("tenant_subscriptions")
      .select("*, pricing_plan:pricing_plans(*)")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .single();

    if (!currentSub?.stripe_subscription_id) {
      throw new Error("No active Stripe subscription found");
    }

    // Get target plan
    const { data: targetPlan } = await supabase
      .from("pricing_plans")
      .select("*")
      .eq("id", target_plan_id)
      .single();

    if (!targetPlan) {
      throw new Error("Target plan not found");
    }

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
    const currentItemId = stripeSubscription.items.data[0]?.id;
    if (!currentItemId) {
      throw new Error("No subscription item found");
    }

    logStep("Updating Stripe subscription", { 
      subscriptionId: currentSub.stripe_subscription_id,
      newPriceId 
    });

    // Update the subscription in Stripe
    const updatedSubscription = await stripe.subscriptions.update(
      currentSub.stripe_subscription_id,
      {
        items: [
          {
            id: currentItemId,
            price: newPriceId,
          },
        ],
        proration_behavior: proration_behavior as Stripe.SubscriptionUpdateParams.ProrationBehavior,
        metadata: {
          tenantId,
          planId: target_plan_id,
        },
      }
    );
    logStep("Stripe subscription updated", { status: updatedSubscription.status });

    // Update local subscription record
    await supabase
      .from("tenant_subscriptions")
      .update({
        plan_id: target_plan_id,
        billing_interval: newInterval,
        current_period_start: new Date(updatedSubscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);

    // Update tenant record
    await supabase
      .from("tenants")
      .update({
        subscription_plan: targetPlan.slug || target_plan_id,
      })
      .eq("id", tenantId);

    // Migrate add-ons that are now included in the plan
    const { data: activeAddons } = await supabase
      .from("tenant_addons")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    const migratedAddons: string[] = [];

    for (const addon of activeAddons || []) {
      const featureKey = addon.addon_type.replace('_addon', '');
      const targetFeatures = targetPlan.features as Record<string, boolean>;
      
      if (targetFeatures?.[featureKey] === true) {
        logStep("Migrating addon", { addonType: addon.addon_type });

        // Cancel addon subscription in Stripe if exists
        if (addon.stripe_subscription_id) {
          try {
            await stripe.subscriptions.cancel(addon.stripe_subscription_id);
            logStep("Addon Stripe subscription cancelled", { 
              addonSubId: addon.stripe_subscription_id 
            });
          } catch (e) {
            logStep("Failed to cancel addon subscription", { 
              error: e instanceof Error ? e.message : String(e) 
            });
          }
        }

        // Update addon status
        await supabase
          .from("tenant_addons")
          .update({
            status: "cancelled",
            migrated_at: new Date().toISOString(),
            migrated_to_plan: target_plan_id,
            cancelled_at: new Date().toISOString(),
          })
          .eq("id", addon.id);

        migratedAddons.push(addon.addon_type);
      }
    }

    // Create notification for user
    await supabase.from("admin_notifications").insert({
      tenant_id: tenantId,
      category: "billing",
      notification_type: "plan_upgraded",
      title: `Plan gewijzigd naar ${targetPlan.name}`,
      message: migratedAddons.length > 0
        ? `Je plan is gewijzigd naar ${targetPlan.name}. ${migratedAddons.length} add-on(s) zijn nu inbegrepen in je plan.`
        : `Je plan is succesvol gewijzigd naar ${targetPlan.name}.`,
      priority: "medium",
      action_url: "/admin/billing",
    });

    logStep("Plan switch complete", { 
      newPlan: targetPlan.name, 
      migratedAddons 
    });

    return new Response(JSON.stringify({
      success: true,
      new_plan: {
        id: targetPlan.id,
        name: targetPlan.name,
        interval: newInterval,
      },
      migrated_addons: migratedAddons,
      stripe_subscription_id: updatedSubscription.id,
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
