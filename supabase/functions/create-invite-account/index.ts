import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// BUILD-GREEN-1: `ReturnType<typeof createClient>` werd met de nieuwere supabase-js een
// client met schema `never` (elke rij `never`). Het type uit dezelfde module heeft
// een ongetypeerd schema en past altijd op wat createClient hier teruggeeft.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function findAuthUserIdByEmail(supabase: SupabaseClient, email: string): Promise<string | null> {
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
  // SEC-INVITE-1: neveneffectvrije versiestempel om de deploy te bewijzen.
  if (req.method === "GET") return json(200, { ok: true, version: "SEC-INVITE-1" });
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

    // 2. SEC-INVITE-1 (13-10-2026): NOOIT een bestaand account aanpassen.
    //
    // Tot nu toe zette deze functie het wachtwoord van een BESTAANDE auth-user met
    // het uitnodigings-e-mailadres op wat de aanroeper meestuurde. Een tenant-admin
    // mag uitnodigingen met elk e-mailadres aanmaken en het token lezen (RLS "Admins
    // can manage invitations"), dus elke winkeleigenaar kon zo elk account
    // overnemen — ook dat van de platform-admin. Een uitnodigingstoken bewijst
    // alleen dat iemand een nieuwe gebruiker mag worden, niet dat hij een bestaand
    // account bezit. Bestaande gebruikers loggen in (of gebruiken "wachtwoord
    // vergeten") en aanvaarden daarna; accept-team-invitation controleert de match.
    const existingUserId = await findAuthUserIdByEmail(supabase, email);
    if (existingUserId) {
      return json(409, {
        error: "Er bestaat al een account voor dit e-mailadres. Log in (of gebruik 'Wachtwoord vergeten') en open de uitnodiging daarna opnieuw.",
        code: "account_exists",
      });
    }

    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !newUser?.user) {
      // Bestaat het account intussen toch (race of geen profiel-rij)? Dan niet
      // overschrijven, maar dezelfde 409 als hierboven.
      const raceUserId = await findAuthUserIdByEmail(supabase, email);
      if (raceUserId) {
        return json(409, {
          error: "Er bestaat al een account voor dit e-mailadres. Log in (of gebruik 'Wachtwoord vergeten') en open de uitnodiging daarna opnieuw.",
          code: "account_exists",
        });
      }
      console.error("createUser failed", createErr);
      return json(500, { error: "Kon account niet aanmaken: " + (createErr?.message ?? "unknown") });
    }
    const created = true;

    return json(200, { success: true, created, email });
  } catch (e: any) {
    console.error("create-invite-account error", e);
    return json(500, { error: e?.message || "Onbekende fout" });
  }
});