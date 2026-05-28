import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RemoveRequest {
  memberId: string; // user_roles.id
  tenantId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const auth = await authenticateRequest(req);
    const callerId = auth.user_id;

    const { memberId, tenantId }: RemoveRequest = await req.json();
    if (!memberId || !tenantId) {
      return new Response(
        JSON.stringify({ error: "memberId and tenantId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorization: platform_admin OR tenant_admin for this tenant
    let isAuthorized = false;
    const { data: pAdmin } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", callerId)
      .eq("role", "platform_admin")
      .is("tenant_id", null)
      .maybeSingle();
    if (pAdmin) isAuthorized = true;

    if (!isAuthorized) {
      const { data: tAdmin } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", callerId)
        .eq("tenant_id", tenantId)
        .eq("role", "tenant_admin")
        .maybeSingle();
      if (tAdmin) isAuthorized = true;
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Niet geautoriseerd voor deze tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the member row we are about to remove
    const { data: targetRole, error: targetErr } = await supabase
      .from("user_roles")
      .select("id, user_id, role, tenant_id")
      .eq("id", memberId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (targetErr || !targetRole) {
      return new Response(
        JSON.stringify({ error: "Teamlid niet gevonden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Lock-out guard: never remove the last tenant_admin
    if (targetRole.role === "tenant_admin") {
      const { count } = await supabase
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("role", "tenant_admin");
      if ((count ?? 0) <= 1) {
        return new Response(
          JSON.stringify({
            error:
              "Kan de laatste admin van deze winkel niet verwijderen. Wijs eerst een andere admin aan.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get email for invitation cleanup
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", targetRole.user_id)
      .maybeSingle();

    // 1) Remove the role row (revokes access for this tenant only)
    const { error: deleteErr } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", memberId)
      .eq("tenant_id", tenantId);
    if (deleteErr) throw deleteErr;

    // 2) Drop any pending invitation for this email + tenant so a fresh
    //    re-invite later behaves like a clean slate.
    if (profile?.email) {
      await supabase
        .from("team_invitations")
        .delete()
        .eq("tenant_id", tenantId)
        .ilike("email", profile.email)
        .is("accepted_at", null);
    }

    // 3) Audit log (best effort)
    try {
      await supabase.rpc("log_admin_action", {
        p_target_tenant_id: tenantId,
        p_action_type: "team_member_removed",
        p_action_details: {
          removed_user_id: targetRole.user_id,
          removed_email: profile?.email ?? null,
          removed_role: targetRole.role,
        },
      });
    } catch (logErr) {
      console.warn("audit log failed", logErr);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error("remove-team-member error", error);
    return new Response(
      JSON.stringify({ error: error.message || "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});