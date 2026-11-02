// KASSA-ACCOUNT-1 — een kassatoestel ontkoppelen vanuit beheer (Kassa (POS) › Kassa's › Ontkoppelen).
//
// Enkel een tenant_admin van de zaak van dat toestel (of platformbeheer). Stappen:
//   1. revoked_at zetten op de koppelrij: vanaf dan weigert elke kassa-RPC en elke policy het toestel
//      (ook met een nog geldig toegangstoken).
//   2. De pushtokens van het toestel weg (geen meldingen meer naar dat toestel).
//   3. De toestel-user bannen, zodat hij zijn sessie niet meer kan verversen.
// Idempotent: een al ontkoppeld toestel opnieuw ontkoppelen = opnieuw bannen, geen fout.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { authenticateRequest, AuthError, authErrorResponse, requireRole } from "../_shared/auth.ts";

const VERSION = "KASSA-ACCOUNT-1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BAN_DURATION = "876000h";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: VERSION });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  try {
    // Eerst de sessie: wie niet aangemeld is, leert niets over het toestel.
    const auth = await authenticateRequest(req);
    const body = await req.json().catch(() => null) as { user_id?: unknown } | null;
    const userId = typeof body?.user_id === "string" ? body.user_id.toLowerCase() : "";
    if (!UUID.test(userId)) return json({ error: "invalid_input" }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: row } = await db.from("kassa_device_accounts").select("user_id, tenant_id, revoked_at").eq("user_id", userId).maybeSingle();
    if (!row) return json({ error: "not_found" }, 404);
    requireRole(auth, (row as { tenant_id: string }).tenant_id, ["tenant_admin"]);

    if (!(row as { revoked_at: string | null }).revoked_at) {
      const { error } = await db.from("kassa_device_accounts")
        .update({ revoked_at: new Date().toISOString(), revoked_by: auth.user_id === "service_role" ? null : auth.user_id })
        .eq("user_id", userId).is("revoked_at", null);
      if (error) throw new Error(`revoke: ${error.message}`);
    }
    const { error: tokErr } = await db.from("device_tokens").delete().eq("user_id", userId);
    if (tokErr) console.error("[kassa-device-revoke] pushtokens", tokErr.message);
    const { error: banErr } = await db.auth.admin.updateUserById(userId, { ban_duration: BAN_DURATION });
    // Geen ban = de koppeling is wél al ingetrokken (alles weigert); melden zodat beheer het ziet.
    if (banErr) return json({ ok: true, revoked: true, banned: false });
    return json({ ok: true, revoked: true, banned: true });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, corsHeaders);
    console.error("[kassa-device-revoke]", e instanceof Error ? e.message : e);
    return json({ error: "server" }, 500);
  }
});
