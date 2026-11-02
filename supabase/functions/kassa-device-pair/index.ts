// KASSA-ACCOUNT-1 — een kassatoestel koppelen met een koppelcode (6 cijfers) of het QR-token uit beheer.
//
// Zonder sessie (verify_jwt = false): het toestel heeft nog geen account. Stappen:
//   1. kassa_pair_claim(code, ip): rate limit (5 fouten per IP per 15 min, 300 platformbreed) en de code
//      eenmalig claimen (atomair, in de databank).
//   2. Met de service role een auth-user voor het toestel maken: adres zonder mailbox
//      (kassa-<random>@toestel.sellqo.app), willekeurig wachtwoord, e-mail bevestigd,
//      app_metadata.kind = 'kassa'. Niet in user_roles: zie de migratie (default-deny).
//   3. kassa_pair_complete: de koppelrij (zaak, kassa, device_uuid). Een vorige koppeling van hetzelfde
//      toestel in deze zaak wordt ingetrokken; die users worden hier gebannen.
//   4. Eénmalig e-mail + wachtwoord terug; het toestel meldt zich daarmee aan (signInWithPassword) en houdt
//      de sessie zoals vandaag. Het wachtwoord wordt nergens bewaard.
// Mislukt stap 2 of 3: de code komt vrij (kassa_pair_release) en een half aangemaakte user wordt verwijderd.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const VERSION = "KASSA-ACCOUNT-1";
const DEVICE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SECRET = /^([0-9]{6}|[0-9a-f]{64})$/;
/** Ver in de toekomst: een gebannen toestel-user kan zijn sessie niet meer verversen. */
const BAN_DURATION = "876000h";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function randomPassword(): string {
  const b = crypto.getRandomValues(new Uint8Array(36));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: VERSION });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  try {
    const body = await req.json().catch(() => null) as { code?: unknown; device_uuid?: unknown; device_name?: unknown } | null;
    const secret = typeof body?.code === "string" ? body.code.replace(/\s/g, "").toLowerCase() : "";
    const deviceUuid = typeof body?.device_uuid === "string" ? body.device_uuid.trim().toLowerCase() : "";
    const deviceName = typeof body?.device_name === "string" ? body.device_name.trim().slice(0, 60) : "";
    if (!SECRET.test(secret) || !DEVICE_UUID.test(deviceUuid)) return json({ error: "invalid_input" }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    const { data: claim, error: claimErr } = await db.rpc("kassa_pair_claim", { p_secret: secret, p_ip: clientIp(req) });
    if (claimErr) throw new Error(`claim: ${claimErr.message}`);
    const c = claim as { ok: boolean; reason?: string; code_id?: string; tenant_id?: string; terminal_id?: string; terminal_name?: string; name?: string };
    if (!c?.ok) return c?.reason === "rate_limited" ? json({ error: "rate_limited" }, 429) : json({ error: "invalid_code" }, 404);

    const email = `kassa-${crypto.randomUUID()}@toestel.sellqo.app`;
    const password = randomPassword();
    const label = deviceName || c.name || c.terminal_name || "Kassa";
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { kind: "kassa", tenant_id: c.tenant_id, terminal_id: c.terminal_id },
      user_metadata: { full_name: `Kassa · ${label}` },
    });
    const userId = (created as { user?: { id?: string } } | null)?.user?.id;
    if (createErr || !userId) {
      await db.rpc("kassa_pair_release", { p_code_id: c.code_id });
      throw new Error(`createUser: ${createErr?.message ?? "geen user"}`);
    }

    const { data: done, error: doneErr } = await db.rpc("kassa_pair_complete", {
      p_code_id: c.code_id, p_user_id: userId, p_device_uuid: deviceUuid, p_name: deviceName || null,
    });
    if (doneErr) {
      await db.auth.admin.deleteUser(userId);
      await db.rpc("kassa_pair_release", { p_code_id: c.code_id });
      throw new Error(`complete: ${doneErr.message}`);
    }
    // Vorige account(s) van dit toestel: al ingetrokken in de databank; nu ook geen sessie meer.
    for (const old of ((done as { replaced?: string[] } | null)?.replaced ?? [])) {
      const { error } = await db.auth.admin.updateUserById(old, { ban_duration: BAN_DURATION });
      if (error) console.error("[kassa-device-pair] ban vorige account mislukt", old, error.message);
    }

    return json({ ok: true, email, password, tenant_id: c.tenant_id, terminal_id: c.terminal_id, terminal_name: c.terminal_name ?? null });
  } catch (e) {
    console.error("[kassa-device-pair]", e instanceof Error ? e.message : e);
    return json({ error: "server" }, 500);
  }
});
