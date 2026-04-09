import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@13.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth validation failed:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      console.error("Role lookup failed:", rolesError);
      return new Response(
        JSON.stringify({ error: "Failed to verify permissions" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const isPlatformAdmin = roles?.some((r: any) =>
      r.role === "platform_admin"
    );
    if (!isPlatformAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: platform_admin required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("Authorization passed, proceeding with cleanup...");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Use service role client for tenant updates
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tenants, error: fetchError } = await supabaseAdmin
      .from("tenants")
      .select("id, name, stripe_account_id")
      .not("stripe_account_id", "is", null);

    if (fetchError) {
      console.error("Failed to fetch tenants:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch tenants" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`Found ${tenants?.length || 0} tenants with Stripe accounts`);

    let cleaned = 0;
    const failed: { tenant_id: string; tenant_name: string; error: string }[] =
      [];

    for (const tenant of tenants || []) {
      console.log(
        `Processing tenant ${tenant.id} (${tenant.name}) - account: ${tenant.stripe_account_id}`,
      );
      try {
        await stripe.accounts.del(tenant.stripe_account_id);
        console.log(`Deleted Stripe account ${tenant.stripe_account_id}`);
      } catch (stripeErr: any) {
        const code = stripeErr?.code || stripeErr?.raw?.code || "";
        const message = stripeErr?.message || "";
        // If account already gone, proceed with cleanup
        if (
          code === "account_invalid" || message.includes("No such account") ||
          message.includes("does not exist")
        ) {
          console.log(
            `Account ${tenant.stripe_account_id} already deleted, proceeding with cleanup`,
          );
        } else {
          console.error(
            `Failed to delete account for tenant ${tenant.id}:`,
            message,
          );
          failed.push({
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            error: message,
          });
          continue;
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from("tenants")
        .update({
          stripe_account_id: null,
          stripe_charges_enabled: false,
          stripe_details_submitted: false,
          stripe_payouts_enabled: false,
        })
        .eq("id", tenant.id);

      if (updateError) {
        console.error(`Failed to update tenant ${tenant.id}:`, updateError);
        failed.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          error: "DB update failed",
        });
      } else {
        cleaned++;
        console.log(`Cleaned tenant ${tenant.id}`);
      }
    }

    console.log(`Done. Cleaned: ${cleaned}, Failed: ${failed.length}`);

    return new Response(
      JSON.stringify({ success: true, cleaned, failed }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
