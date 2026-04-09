import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DISCONNECT-STRIPE] ${step}${detailsStr}`);
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
    logStep("User authenticated", { userId: user.id });

    // Parse body
    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id is required");

    // Check authorization: platform_admin OR tenant owner
    const { data: adminRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "platform_admin")
      .maybeSingle();

    if (!adminRole) {
      // Check if user is tenant owner
      const { data: membership } = await supabaseClient
        .from("tenant_users")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", tenant_id)
        .eq("role", "owner")
        .maybeSingle();

      if (!membership) {
        return new Response(
          JSON.stringify({ error: "Niet geautoriseerd" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    logStep("Authorization verified");

    // Fetch tenant
    const { data: tenant, error: tenantError } = await supabaseClient
      .from("tenants")
      .select("id, name, stripe_account_id")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant niet gevonden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tenant.stripe_account_id) {
      return new Response(
        JSON.stringify({ error: "Geen Stripe account verbonden" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Deleting Stripe account", { stripeAccountId: tenant.stripe_account_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    try {
      await stripe.accounts.del(tenant.stripe_account_id);
      logStep("Stripe account deleted successfully");
    } catch (stripeErr: any) {
      if (stripeErr?.code === "account_invalid" || stripeErr?.statusCode === 404) {
        logStep("Stripe account already deleted/not found, continuing cleanup");
      } else {
        logStep("Stripe delete failed", { error: stripeErr.message });
        return new Response(
          JSON.stringify({ error: `Stripe fout: ${stripeErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Clear tenant Stripe fields
    const { error: updateError } = await supabaseClient
      .from("tenants")
      .update({
        stripe_account_id: null,
        stripe_charges_enabled: false,
        stripe_details_submitted: false,
        stripe_payouts_enabled: false,
      })
      .eq("id", tenant_id);

    if (updateError) {
      logStep("Failed to update tenant", { error: updateError.message });
      return new Response(
        JSON.stringify({ error: `Database update mislukt: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Tenant updated, disconnect complete");

    return new Response(
      JSON.stringify({ success: true, message: "Stripe account ontkoppeld en verwijderd" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
