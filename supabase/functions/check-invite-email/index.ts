import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckRequest {
  email: string;
  tenant_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const auth = await authenticateRequest(req);
    const { email, tenant_id }: CheckRequest = await req.json();

    if (!email || !tenant_id) {
      return new Response(JSON.stringify({ error: "email and tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    requireRole(auth, tenant_id, ["tenant_admin"]);

    const normalized = email.trim().toLowerCase();

    // 1. Account exists?
    let accountExists = false;
    let alreadyMember = false;
    let userId: string | null = null;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", normalized)
        .maybeSingle();
      if (profile?.id) {
        accountExists = true;
        userId = profile.id;
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", profile.id)
          .eq("tenant_id", tenant_id)
          .maybeSingle();
        alreadyMember = !!existingRole;
      }
    } catch (e) {
      console.warn("profile lookup failed", e);
    }

    // 2. Pending invite for this tenant + email?
    let hasPendingInvite = false;
    let pendingInviteId: string | null = null;
    try {
      const { data: pending } = await supabase
        .from("team_invitations")
        .select("id, status, expires_at")
        .eq("tenant_id", tenant_id)
        .ilike("email", normalized)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pending?.id) {
        hasPendingInvite = true;
        pendingInviteId = pending.id;
      }
    } catch (e) {
      console.warn("pending invite lookup failed", e);
    }

    return new Response(
      JSON.stringify({
        accountExists,
        alreadyMember,
        hasPendingInvite,
        pendingInviteId,
        userId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error("check-invite-email error", error);
    return new Response(JSON.stringify({ error: error.message || "Onbekende fout" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});