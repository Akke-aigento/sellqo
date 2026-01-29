import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-TENANT] ${step}${detailsStr}`);
};

// Find an available slug variant if the base slug is taken
async function findAvailableSlug(supabase: any, baseSlug: string): Promise<string> {
  // Check if base slug is free
  const { data: existing } = await supabase
    .from("tenants")
    .select("slug")
    .eq("slug", baseSlug)
    .limit(1);
  
  if (!existing || existing.length === 0) {
    return baseSlug;
  }
  
  // Try numbered variants: slug-2, slug-3, etc.
  for (let i = 2; i <= 10; i++) {
    const candidate = `${baseSlug}-${i}`;
    const { data: check } = await supabase
      .from("tenants")
      .select("slug")
      .eq("slug", candidate)
      .limit(1);
    if (!check || check.length === 0) {
      return candidate;
    }
  }
  
  // Fallback: slug + random suffix
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${baseSlug}-${randomSuffix}`;
}

type TenantPayload = {
  name?: string;
  slug?: string;
  owner_name?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  btw_number?: string | null;
  kvk_number?: string | null;
  billing_email?: string | null;
  billing_company_name?: string | null;
  selected_plan_id?: string | null; // Plan selected during onboarding
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

    // Auth header is required
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

    const body = (await req.json()) as TenantPayload;
    const ownerEmail = (user.email || "").trim().toLowerCase();
    if (!ownerEmail) {
      return new Response(JSON.stringify({ error: "User email missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const name = body.name?.trim();
    const slug = body.slug?.trim();
    if (!name || !slug) {
      return new Response(JSON.stringify({ error: "Missing name or slug" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("User authenticated", { userId: user.id, email: ownerEmail });

    // If a tenant already exists for this owner email, return it.
    const { data: existing } = await supabase
      .from("tenants")
      .select("*")
      .eq("owner_email", ownerEmail)
      .limit(1);
    if (existing && existing.length > 0) {
      logStep("Existing tenant found", { tenantId: existing[0].id });
      return new Response(JSON.stringify(existing[0]), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Preserve the same business rule as RLS (but executed server-side).
    const { data: canCreate, error: canCreateError } = await supabase.rpc(
      "can_create_first_tenant",
      { _user_id: user.id, _owner_email: ownerEmail }
    );
    if (canCreateError) {
      logStep("can_create_first_tenant error", { error: canCreateError.message });
      return new Response(JSON.stringify({ error: "Unable to validate tenant creation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!canCreate) {
      logStep("Tenant creation blocked by rule");
      return new Response(JSON.stringify({ error: "Not allowed to create tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insertPayload = {
      name,
      slug,
      owner_email: ownerEmail,
      owner_name: body.owner_name ?? null,
      address: body.address ?? null,
      postal_code: body.postal_code ?? null,
      city: body.city ?? null,
      country: body.country ?? null,
      btw_number: body.btw_number ?? null,
      kvk_number: body.kvk_number ?? null,
      billing_email: (body.billing_email ?? ownerEmail) || ownerEmail,
      billing_company_name: body.billing_company_name ?? null,
    };

    // Check if slug is already taken BEFORE inserting
    const { data: slugCheck } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .limit(1);
    
    if (slugCheck && slugCheck.length > 0) {
      // Slug is taken - find an alternative and return 409 Conflict
      logStep("Slug already taken, finding alternative", { slug });
      const suggestedSlug = await findAvailableSlug(supabase, slug);
      
      return new Response(JSON.stringify({ 
        error: "slug_conflict",
        message: `De URL '${slug}' is al in gebruik.`,
        original_slug: slug,
        suggested_slug: suggestedSlug,
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Inserting tenant", { slug });
    const { data: tenant, error: insertError } = await supabase
      .from("tenants")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      // Handle race condition: duplicate key error
      if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
        logStep("Duplicate key error, finding alternative slug", { slug });
        const suggestedSlug = await findAvailableSlug(supabase, slug);
        
        return new Response(JSON.stringify({ 
          error: "slug_conflict",
          message: `De URL '${slug}' is al in gebruik.`,
          original_slug: slug,
          suggested_slug: suggestedSlug,
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      logStep("Insert failed", { error: insertError.message });
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Tenant created", { tenantId: tenant.id });

    // === CRITICAL: Assign tenant_admin role (trigger fails in service_role context) ===
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({
        user_id: user.id,
        tenant_id: tenant.id,
        role: 'tenant_admin',
      }, { 
        onConflict: 'user_id,role,tenant_id',
        ignoreDuplicates: true 
      });

    if (roleError) {
      logStep("WARNING: Failed to assign role", { error: roleError.message });
      // Don't fail the request - tenant is created
    } else {
      logStep("Role assigned successfully");
    }

    // === Update subscription with selected plan (if not free) ===
    const selectedPlanId = body.selected_plan_id;
    if (selectedPlanId && selectedPlanId !== 'free') {
      const { error: subError } = await supabase
        .from("tenant_subscriptions")
        .update({ plan_id: selectedPlanId })
        .eq("tenant_id", tenant.id);
      
      if (subError) {
        logStep("WARNING: Failed to update subscription plan", { error: subError.message });
      } else {
        logStep("Subscription plan updated", { plan: selectedPlanId });
      }
    }

    return new Response(JSON.stringify(tenant), {
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
