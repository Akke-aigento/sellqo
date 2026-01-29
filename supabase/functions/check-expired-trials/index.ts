import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-EXPIRED-TRIALS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing backend env vars");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all expired trials
    const { data: expiredTrials, error: fetchError } = await supabase
      .from("tenant_subscriptions")
      .select("id, tenant_id, plan_id")
      .eq("status", "trialing")
      .not("trial_end", "is", null)
      .lte("trial_end", new Date().toISOString())
      .neq("plan_id", "free");

    if (fetchError) {
      logStep("Error fetching expired trials", { error: fetchError.message });
      throw fetchError;
    }

    if (!expiredTrials || expiredTrials.length === 0) {
      logStep("No expired trials found");
      return new Response(JSON.stringify({ downgraded: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Found expired trials", { count: expiredTrials.length });

    // Downgrade each expired trial
    const subscriptionIds = expiredTrials.map(t => t.id);
    const { error: updateError } = await supabase
      .from("tenant_subscriptions")
      .update({
        plan_id: "free",
        status: "active",
        trial_end: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", subscriptionIds);

    if (updateError) {
      logStep("Error updating subscriptions", { error: updateError.message });
      throw updateError;
    }

    logStep("Successfully downgraded trials", { count: expiredTrials.length });

    // Send post-downgrade notifications
    for (const trial of expiredTrials) {
      try {
        await supabase
          .from('notifications')
          .insert({
            tenant_id: trial.tenant_id,
            category: 'billing',
            type: 'trial_expired',
            title: 'Je proefperiode is verlopen',
            message: 'Je bent nu op het gratis plan. Al je data is behouden - upgrade om alle features te herstellen.',
            priority: 'high',
            action_url: '/admin/settings/billing',
            data: {
              previous_plan_id: trial.plan_id,
              downgraded_at: new Date().toISOString(),
            }
          });
        logStep("Post-downgrade notification sent", { tenant_id: trial.tenant_id });
      } catch (notifErr) {
        logStep("Error sending post-downgrade notification", { error: String(notifErr), tenant_id: trial.tenant_id });
      }
    }

    return new Response(JSON.stringify({ 
      downgraded: expiredTrials.length,
      tenant_ids: expiredTrials.map(t => t.tenant_id),
      notifications_sent: expiredTrials.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
