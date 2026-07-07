import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  token: string;
  password: string;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function findAuthUserIdByEmail(supabase: ReturnType<typeof createClient>, email: string): Promise<string | null> {
  const normalized = email.toLowerCase();

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  if (existingProfile?.id) return existingProfile.id;

  // Defensive fallback for orphaned auth users without a profiles row.
  // This avoids a dead-end where createUser returns "already registered"
  // but we cannot update the password through the profile lookup.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.warn("listUsers fallback failed", error);
      return null;
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match?.id) return match.id;
    if (data.users.length < 1000) break;
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, password }: Body = await req.json();
    if (!token) return json(400, { error: "Token ontbreekt" });
    if (!password || password.length < 8) {
      return json(400, { error: "Wachtwoord moet minimaal 8 tekens zijn" });
    }

    // 1. Validate invitation
    const { data: invitation, error: invErr } = await supabase
      .from("team_invitations")
      .select("id, tenant_id, email, accepted_at, expires_at, status")
      .eq("token", token)
      .maybeSingle();

    if (invErr || !invitation) return json(404, { error: "Uitnodiging niet gevonden" });
    if (invitation.accepted_at) return json(409, { error: "Deze uitnodiging is reeds geaccepteerd" });
    if (invitation.status === "revoked" || invitation.status === "rejected") {
      return json(410, { error: "Deze uitnodiging is ingetrokken" });
    }
    if (new Date(invitation.expires_at) < new Date()) {
      return json(410, { error: "Deze uitnodiging is verlopen" });
    }

    const email = invitation.email.toLowerCase();

    // 2. Check of auth-user bestaat. Prefer profiles, maar val terug op
    // Auth Admin lookup zodat orphaned users zonder profiel ook werken.
    let userId: string | null = await findAuthUserIdByEmail(supabase, email);
    let created = false;

    if (userId) {
      // Bestaande shell auth-user: update wachtwoord + bevestig email
      const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (updErr) {
        console.error("updateUserById failed", updErr);
        return json(500, { error: "Kon wachtwoord niet instellen: " + updErr.message });
      }
    } else {
      // Nieuwe user: aanmaken met bevestigd emailadres (invite-token = bewijs)
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr || !newUser?.user) {
        const retryUserId = await findAuthUserIdByEmail(supabase, email);
        if (!retryUserId) {
          console.error("createUser failed", createErr);
          return json(500, { error: "Kon account niet aanmaken: " + (createErr?.message ?? "unknown") });
        }
        const { error: updErr } = await supabase.auth.admin.updateUserById(retryUserId, {
          password,
          email_confirm: true,
        });
        if (updErr) {
          console.error("updateUserById after create conflict failed", updErr);
          return json(500, { error: "Kon wachtwoord niet instellen: " + updErr.message });
        }
        userId = retryUserId;
      } else {
        userId = newUser.user.id;
        created = true;
      }
    }

    return json(200, { success: true, created, email });
  } catch (e: any) {
    console.error("create-invite-account error", e);
    return json(500, { error: e?.message || "Onbekende fout" });
  }
});