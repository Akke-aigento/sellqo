import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REPAIR-TENANT-ACCESS] ${step}${detailsStr}`);
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

    // Validate user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      logStep("Auth failed", { error: authError?.message });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userEmail = (user.email || "").trim().toLowerCase();
    logStep("Checking for orphaned tenant", { userId: user.id, email: userEmail });

    // Find tenant by owner_email
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("owner_email", userEmail)
      .limit(1)
      .maybeSingle();

    if (!tenant) {
      logStep("No tenant found for this email");
      return new Response(JSON.stringify({ repaired: false, reason: "no_tenant" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Found tenant", { tenantId: tenant.id, name: tenant.name });

    // Check if role already exists
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant.id)
      .limit(1)
      .maybeSingle();

    if (existingRole) {
      logStep("Role already exists");
      return new Response(JSON.stringify({ repaired: false, reason: "role_exists" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert missing role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: user.id,
        tenant_id: tenant.id,
        role: 'tenant_admin',
      });

    if (roleError) {
      logStep("Failed to insert role", { error: roleError.message });
      return new Response(JSON.stringify({ repaired: false, error: roleError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Successfully repaired access", { tenantId: tenant.id });
    return new Response(JSON.stringify({ 
      repaired: true, 
      tenant_id: tenant.id,
      tenant_name: tenant.name,
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
