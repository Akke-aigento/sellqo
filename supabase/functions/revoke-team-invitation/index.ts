import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RevokeRequest {
  invitation_id: string;
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
    const { invitation_id }: RevokeRequest = await req.json();
    if (!invitation_id) {
      return new Response(JSON.stringify({ error: "invitation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invitation, error: fetchErr } = await supabase
      .from("team_invitations")
      .select("id, tenant_id, email, role, status, accepted_at")
      .eq("id", invitation_id)
      .maybeSingle();

    if (fetchErr || !invitation) {
      return new Response(JSON.stringify({ error: "Uitnodiging niet gevonden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    requireRole(auth, invitation.tenant_id, ["tenant_admin"]);

    if (invitation.status !== "pending") {
      return new Response(
        JSON.stringify({
          error: "Alleen uitnodigingen met status 'pending' kunnen worden ingetrokken",
          currentStatus: invitation.status,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nowIso = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("team_invitations")
      .update({
        status: "revoked",
        revoked_at: nowIso,
        revoked_by: auth.user_id === "service_role" ? null : auth.user_id,
      })
      .eq("id", invitation.id);

    if (updErr) throw updErr;

    try {
      await supabase.from("invite_audit_log").insert({
        invitation_id: invitation.id,
        tenant_id: invitation.tenant_id,
        event_type: "revoked",
        actor_user_id: auth.user_id === "service_role" ? null : auth.user_id,
        actor_email: auth.email ?? null,
        metadata: { email: invitation.email, role: invitation.role },
      });
    } catch (auditErr) {
      console.warn("audit log insert failed (revoked)", auditErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error("revoke-team-invitation error", error);
    return new Response(JSON.stringify({ error: error.message || "Onbekende fout" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});