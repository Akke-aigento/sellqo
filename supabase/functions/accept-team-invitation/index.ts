import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptRequest {
  token: string;
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
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { token }: AcceptRequest = await req.json();

    // Get invitation
    const { data: invitation, error: invError } = await supabase
      .from("team_invitations")
      .select("*, tenants(name)")
      .eq("token", token)
      .single();

    if (invError || !invitation) {
      throw new Error("Uitnodiging niet gevonden");
    }

    // Check if already accepted
    if (invitation.accepted_at) {
      throw new Error("Deze uitnodiging is al geaccepteerd");
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error("Deze uitnodiging is verlopen");
    }

    // Verify email matches (case insensitive)
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error("Deze uitnodiging is voor een ander e-mailadres");
    }

    // Check if user already has a role in this tenant
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", invitation.tenant_id)
      .maybeSingle();

    if (existingRole) {
      throw new Error("Je bent al lid van dit team");
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

    // Mark invitation as accepted
    await supabase
      .from("team_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    return new Response(
      JSON.stringify({
        success: true,
        tenantId: invitation.tenant_id,
        tenantName: invitation.tenants?.name,
        role: invitation.role,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error accepting invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
