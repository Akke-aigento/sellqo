import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PLATFORM-GIFT-MONTH] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Check if user is platform admin
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "platform_admin")
      .single();

    if (!adminRole) {
      logStep("User is not platform admin", { userId: user.id });
      return new Response(JSON.stringify({ error: "Not authorized" }), { 
        status: 403, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { tenantId, months = 1 } = await req.json();
    logStep("Gift request", { tenantId, months });

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Missing tenantId" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Get subscription (including trial_end)
    const { data: subscription } = await supabase
      .from("tenant_subscriptions")
      .select("stripe_subscription_id, current_period_end, trial_end")
      .eq("tenant_id", tenantId)
      .single();

    if (!subscription) {
      return new Response(JSON.stringify({ error: "No subscription found for tenant" }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Calculate start date = MAX(trial_end, current_period_end, NOW())
    const now = new Date();
    const candidates = [now];
    if (subscription.trial_end) candidates.push(new Date(subscription.trial_end));
    if (subscription.current_period_end) candidates.push(new Date(subscription.current_period_end));
    const startDate = new Date(Math.max(...candidates.map(d => d.getTime())));

    // Calculate new end date
    const newEndDate = new Date(startDate);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    logStep("Extending subscription", { 
      startDate: startDate.toISOString(), 
      newEndDate: newEndDate.toISOString(),
      hasStripe: !!subscription.stripe_subscription_id
    });

    // If Stripe subscription exists, update Stripe too
    if (subscription.stripe_subscription_id && stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        trial_end: Math.floor(newEndDate.getTime() / 1000),
        proration_behavior: "none",
      });
      logStep("Stripe subscription updated");
    }

    // Always update the database
    await supabase
      .from("tenant_subscriptions")
      .update({
        trial_end: newEndDate.toISOString(),
        current_period_end: newEndDate.toISOString(),
      })
      .eq("tenant_id", tenantId);

    logStep("Database updated");

    // Log admin action
    await supabase
      .from("admin_billing_actions")
      .insert({
        tenant_id: tenantId,
        action: "gift_month",
        details: { months, newEndDate: newEndDate.toISOString(), hasStripe: !!subscription.stripe_subscription_id },
        performed_by: user.id,
      });

    logStep("Gift month applied successfully");

    return new Response(JSON.stringify({ success: true, newEndDate }), {
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
