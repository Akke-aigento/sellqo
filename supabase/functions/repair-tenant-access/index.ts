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

    // Guard A: reject if auth user is too fresh (< 24h) or unconfirmed.
    // Prevents fresh-signup spoofers from grabbing tenant_admin via owner_email match.
    const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
    const ageMs = Date.now() - createdAt;
    const MIN_AGE_MS = 24 * 60 * 60 * 1000;
    if (!user.email_confirmed_at) {
      logStep("Rejected: email not confirmed");
      return new Response(JSON.stringify({ repaired: false, reason: "email_not_confirmed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (ageMs < MIN_AGE_MS) {
      logStep("Rejected: user too new", { ageMs });
      return new Response(JSON.stringify({ repaired: false, reason: "user_too_new" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Guard B: reject if this email was explicitly revoked from this tenant.
    const { data: revocation } = await supabase
      .from("tenant_access_revocations")
      .select("id")
      .eq("tenant_id", tenant.id)
      .ilike("email", userEmail)
      .maybeSingle();
    if (revocation) {
      logStep("Rejected: access explicitly revoked", { tenantId: tenant.id });
      return new Response(JSON.stringify({ repaired: false, reason: "revoked" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
