import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token } = await req.json();

    if (!token) {
      throw new Error("Token is required");
    }

    const { data, error } = await supabase
      .from("team_invitations")
      .select("email, role, expires_at, accepted_at, tenants(name)")
      .eq("token", token)
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: "Uitnodiging niet gevonden" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Determine status
    let status = "valid";
    if (data.accepted_at) {
      status = "accepted";
    } else if (new Date(data.expires_at) < new Date()) {
      status = "expired";
    }

    return new Response(
      JSON.stringify({
        status,
        email: data.email,
        role: data.role,
        tenantName: (data.tenants as any)?.name || "Onbekende winkel",
        expiresAt: data.expires_at,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error fetching invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
