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
      .select("id, email, role, expires_at, accepted_at, tenant_id, invited_by, tenants(name)")
      .eq("token", token)
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: "Uitnodiging niet gevonden" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Determine status via helper (covers revoked/rejected too)
    let status: string = "pending";
    try {
      const { data: effective, error: effErr } = await supabase.rpc(
        "get_invitation_effective_status",
        { inv_id: (data as any).id }
      );
      if (effErr) throw effErr;
      status = (effective as string) || "pending";
    } catch (rpcErr) {
      console.warn("effective_status RPC failed, falling back", rpcErr);
      if (data.accepted_at) status = "accepted";
      else if (new Date(data.expires_at) < new Date()) status = "expired";
    }

    // Detect whether this email already has an auth account, and
    // whether the matching user is already a member of this tenant.
    let accountExists = false;
    let alreadyMember = false;
    let hasUsablePassword = false;
    let freshStart = false;

    // Fresh-start signal: an unresolved revocation for this (tenant, email)
    // means the user was previously removed from this tenant. In that case
    // we ALWAYS route them through the "kies nieuw wachtwoord" flow, since
    // the old password is either forgotten or intentionally invalidated.
    try {
      const { data: rev } = await supabase
        .from("tenant_access_revocations")
        .select("id")
        .eq("tenant_id", data.tenant_id)
        .ilike("email", data.email)
        .maybeSingle();
      freshStart = !!rev;
    } catch (revErr) {
      console.warn("revocation lookup failed", revErr);
    }
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", data.email)
        .maybeSingle();

      if (profile?.id) {
        accountExists = true;
        // Check whether the auth user has a usable password. If not, we
        // must NOT send them to the password-login screen (they'd be
        // stuck). The frontend falls back to OTP + set_password instead.
        try {
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
          const u: any = authUser?.user;
          // encrypted_password isn't exposed through the admin API, but
          // Supabase surfaces it indirectly: users created via
          // signUp/updateUser({password}) have `identities[].provider === 'email'`
          // with `identity_data.email` AND `last_sign_in_at` gets set on
          // any successful signInWithPassword.
          const emailIdentity = (u?.identities || []).find(
            (i: any) => i.provider === "email"
          );
          hasUsablePassword = !!emailIdentity && !!u?.last_sign_in_at;
        } catch (authLookupErr) {
          console.warn("auth user lookup failed", authLookupErr);
          // Fail safe: assume password exists (login-required path); worst
          // case user clicks "wachtwoord vergeten".
          hasUsablePassword = true;
        }
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", profile.id)
          .eq("tenant_id", data.tenant_id)
          .maybeSingle();
        alreadyMember = !!existingRole;
      }
    } catch (lookupErr) {
      // Non-fatal — fall back to default (treat as new account).
      console.warn("account lookup failed", lookupErr);
    }

    // Fresh-start overrides: force new-account-setup flow.
    if (freshStart) {
      hasUsablePassword = false;
    }

    // Inviter display name (optional)
    let invitedByName: string | null = null;
    if ((data as any).invited_by) {
      try {
        const { data: inviter } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", (data as any).invited_by)
          .maybeSingle();
        invitedByName = inviter?.full_name || inviter?.email || null;
      } catch (_e) {
        // non-fatal
      }
    }

    return new Response(
      JSON.stringify({
        status,
        email: data.email,
        role: data.role,
        tenantName: (data.tenants as any)?.name || "Onbekende winkel",
        tenantId: data.tenant_id,
        expiresAt: data.expires_at,
        accountExists,
        hasUsablePassword,
        mailboxConfirmed: accountExists,
        alreadyMember,
        freshStart,
        invitedByName,
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
