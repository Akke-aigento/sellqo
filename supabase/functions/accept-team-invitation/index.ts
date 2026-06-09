import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptRequest {
  token: string;
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Niet ingelogd" });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return jsonResponse(401, { error: "Ongeldige of verlopen sessie" });
    }

    const { token }: AcceptRequest = await req.json();
    if (!token) return jsonResponse(400, { error: "Token ontbreekt" });

    // Re-fetch invitation server-side (don't trust client)
    const { data: invitation, error: invError } = await supabase
      .from("team_invitations")
      .select("id, tenant_id, email, role, accepted_at, expires_at, status, tenants(name)")
      .eq("token", token)
      .maybeSingle();

    if (invError || !invitation) {
      return jsonResponse(404, { error: "Uitnodiging niet gevonden" });
    }

    // Status checks (defensive, in order of severity)
    if (invitation.accepted_at) {
      return jsonResponse(409, { error: "Deze uitnodiging is reeds geaccepteerd" });
    }
    if (invitation.status === "revoked" || invitation.status === "rejected") {
      return jsonResponse(410, { error: "Deze uitnodiging is ingetrokken" });
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return jsonResponse(410, { error: "Deze uitnodiging is verlopen" });
    }

    // KRITIEK — defensieve email-match (server-side)
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return jsonResponse(403, {
        error: "Deze uitnodiging is voor een ander e-mailadres",
        code: "EMAIL_MISMATCH",
      });
    }

    // Check if user already has a role in this tenant
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", invitation.tenant_id)
      .maybeSingle();

    if (existingRole) {
      return jsonResponse(409, { error: "Je bent al lid van dit team" });
    }

    // Add user role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: user.id,
        tenant_id: invitation.tenant_id,
        role: invitation.role,
      });

    if (roleError) {
      throw new Error("Kon rol niet toewijzen: " + roleError.message);
    }

    // Mark invitation as accepted (incl. status)
    await supabase
      .from("team_invitations")
      .update({
        accepted_at: new Date().toISOString(),
        status: "accepted",
      })
      .eq("id", invitation.id);

    // Audit log: 'accepted'
    try {
      await supabase.from("invite_audit_log").insert({
        invitation_id: invitation.id,
        tenant_id: invitation.tenant_id,
        event_type: "accepted",
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        metadata: { role: invitation.role, tenant_id: invitation.tenant_id },
      });
    } catch (auditErr) {
      console.warn("audit log insert failed (accepted)", auditErr);
    }

    return jsonResponse(200, {
      success: true,
      tenantId: invitation.tenant_id,
      tenantName: (invitation.tenants as any)?.name,
      role: invitation.role,
    });
  } catch (error: any) {
    console.error("Error accepting invitation:", error);
    return jsonResponse(500, { error: error.message || "Onbekende fout" });
  }
});
