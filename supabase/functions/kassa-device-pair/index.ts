// KASSA-ACCOUNT-1 — een kassatoestel koppelen met een koppelcode (6 cijfers) of het QR-token uit beheer.
//
// Zonder sessie (verify_jwt = false): het toestel heeft nog geen account. Stappen:
//   1. kassa_pair_claim(code, ip, device_uuid): rate limit (5 fouten per IP per 15 min; platformbreed worden
//      bij een aanval de open 6-cijfercodes ongeldig, nooit een juiste code geweigerd) en de code eenmalig
//      claimen (atomair, in de databank). Een toestel-ID dat al actief gekoppeld is: 409 device_already_paired
//      (geen overname; beheer ontkoppelt eerst), de code blijft geldig.
//   2. Met de service role een auth-user voor het toestel maken: adres zonder mailbox
//      (kassa-<random>@toestel.sellqo.app), willekeurig wachtwoord, e-mail bevestigd,
//      app_metadata.kind = 'kassa'. Niet in user_roles: zie de migratie (default-deny).
//   3. kassa_pair_complete: de koppelrij (zaak, kassa, device_uuid). Intussen (race) toch al gekoppeld = 409.
//   4. Eénmalig e-mail + wachtwoord terug; het toestel meldt zich daarmee aan (signInWithPassword) en houdt
//      de sessie zoals vandaag. Het wachtwoord wordt nergens bewaard.
// Mislukt stap 2 of 3: de code komt vrij (kassa_pair_release) en een half aangemaakte user wordt verwijderd.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const VERSION = "KASSA-ACCOUNT-1";
const DEVICE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SECRET = /^([0-9]{6}|[0-9a-f]{64})$/;

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

/** Review 1: cf-connecting-ip, dan x-real-ip, dan het LAATSTE element van x-forwarded-for (het eerste kiest de
 *  aanroeper zelf, en daarmee zou hij de limiet per IP omzeilen). */
export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return xff.at(-1) ?? "unknown";
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

    const { data: claim, error: claimErr } = await db.rpc("kassa_pair_claim", { p_secret: secret, p_ip: clientIp(req), p_device_uuid: deviceUuid });
    if (claimErr) throw new Error(`claim: ${claimErr.message}`);
    const c = claim as { ok: boolean; reason?: string; code_id?: string; tenant_id?: string; terminal_id?: string; terminal_name?: string; name?: string };
    if (!c?.ok) {
      if (c?.reason === "rate_limited") return json({ error: "rate_limited" }, 429);
      if (c?.reason === "device_already_paired") return json({ error: "device_already_paired" }, 409);
      return json({ error: "invalid_code" }, 404);
    }

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

    const { error: doneErr } = await db.rpc("kassa_pair_complete", {
      p_code_id: c.code_id, p_user_id: userId, p_device_uuid: deviceUuid, p_name: deviceName || null,
    });
    if (doneErr) {
      await db.auth.admin.deleteUser(userId);
      await db.rpc("kassa_pair_release", { p_code_id: c.code_id });
      const code = (doneErr as { code?: string }).code;
      if (code === "KA409" || /device_already_paired/.test(doneErr.message)) return json({ error: "device_already_paired" }, 409);
      throw new Error(`complete: ${doneErr.message}`);
    }

    return json({ ok: true, email, password, tenant_id: c.tenant_id, terminal_id: c.terminal_id, terminal_name: c.terminal_name ?? null });
  } catch (e) {
    console.error("[kassa-device-pair]", e instanceof Error ? e.message : e);
    return json({ error: "server" }, 500);
  }
});
