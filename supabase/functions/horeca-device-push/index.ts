// MELDING-1 — horeca-meldingen naar de toestellen die ze willen (kassa, post, gsm …).
//
// Aangeroepen door de databank (horeca_device_notify, via pg_net) bij een QR-bestelling, een nieuwe
// of klare bon en een online betaling. Nooit door een browser: enkel met X-Internal-Secret.
// Ontvangers = horeca_notify_targets: toestellen met dit event in hun profiel (en voor nieuwe bonnen
// de juiste post), van iemand die nog in het team zit. Deze meldingen komen niet in het belletje.
//
// Een melding met dezelfde tag vervangt de vorige (web: tag/Topic, Android: tag, iOS:
// apns-collapse-id): "Keuken: 3 nieuwe bonnen" in plaats van drie meldingen onder elkaar.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { sendWebPush } from "../_shared/webpush.ts";
import { getFcmAccessToken, readServiceAccount } from "../_shared/fcm.ts";
import { buildHorecaPush, HORECA_EVENTS, HORECA_PUSH_TTL_SECONDS, type HorecaPushCtx } from "../_shared/horecaPush.ts";

const VERSION = "MELDING-1c";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

interface Target { install_id: string; lang: string; kind: string | null; token: string; platform: string; p256dh: string | null; auth: string | null }

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, version: VERSION });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const internalSecret = req.headers.get("X-Internal-Secret")?.trim();
    const { data: secretRow } = await supabase.from("internal_config").select("value").eq("key", "internal_webhook_secret").maybeSingle();
    const expected = (secretRow?.value as string | undefined)?.trim();
    if (!internalSecret || !expected || internalSecret !== expected) return json({ error: "Unauthorized internal call" }, 401);

    const body = await req.json().catch(() => null) as { tenant_id?: string; event?: string; station_id?: string | null; ctx?: HorecaPushCtx } | null;
    const tenantId = body?.tenant_id ?? "";
    const event = body?.event ?? "";
    const stationId = body?.station_id && UUID.test(body.station_id) ? body.station_id : null;
    if (!UUID.test(tenantId) || !HORECA_EVENTS.includes(event as never)) return json({ error: "tenant_id and a known event are required" }, 400);
    const ctx: HorecaPushCtx = body?.ctx && typeof body.ctx === "object" ? body.ctx : {};

    const { data: rows, error: tErr } = await supabase.rpc("horeca_notify_targets", { p_tenant_id: tenantId, p_event: event, p_station_id: stationId });
    if (tErr) throw tErr;
    // Eén bericht per token (een toestel kan via twee accounts ingeschreven zijn).
    const targets = [...new Map(((rows ?? []) as Target[]).map((r) => [r.token, r])).values()];
    if (targets.length === 0) return json({ skipped: true, reason: "no_devices" });

    const stale: string[] = [];
    let webSent = 0, webFailed = 0, fcmSent = 0, fcmFailed = 0;

    const web = targets.filter((x) => x.platform === "web");
    if (web.length > 0) {
      const { data: vapidRow } = await supabase.from("internal_config").select("value").eq("key", "vapid_private_jwk").maybeSingle();
      let jwk: JsonWebKey | null = null;
      try { jwk = vapidRow?.value ? JSON.parse(vapidRow.value as string) as JsonWebKey : null; } catch { jwk = null; }
      for (const d of web) {
        const msg = buildHorecaPush(event, ctx, d.lang, stationId, d.kind);
        if (!msg || !jwk || !d.p256dh || !d.auth) { webFailed++; continue; }
        const r = await sendWebPush({ endpoint: d.token, p256dh: d.p256dh, auth: d.auth }, msg, jwk, HORECA_PUSH_TTL_SECONDS);
        if (r.status >= 200 && r.status < 300) webSent++;
        else {
          webFailed++;
          if (r.gone) stale.push(d.token);
          console.error(`web push failed (${r.status}): ${r.error ?? ""}`);
        }
      }
      if (!jwk) console.error("vapid_private_jwk not configured — web push skipped");
    }

    const native = targets.filter((x) => x.platform !== "web");
    if (native.length > 0) {
      const sa = readServiceAccount(Deno.env.get("FIREBASE_SERVICE_ACCOUNT"));
      let accessToken: string | null = null;
      if (sa) {
        try { accessToken = await getFcmAccessToken(sa); } catch (e) { console.error("FCM auth failed:", e instanceof Error ? e.message : String(e)); }
      } else {
        console.error("FIREBASE_SERVICE_ACCOUNT not configured");
      }
      for (const d of native) {
        const msg = buildHorecaPush(event, ctx, d.lang, stationId, d.kind);
        if (!msg || !accessToken || !sa) { fcmFailed++; continue; }
        try {
          const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              message: {
                token: d.token,
                notification: { title: msg.title, body: msg.body },
                data: { action_url: msg.url, type: `horeca_${event}`, category: "orders", tenant_id: tenantId },
                // Vervalt na 15 min: een toestel dat 's nachts offline lag, krijgt 's ochtends geen oude bonnen.
                apns: {
                  headers: { "apns-collapse-id": msg.tag, "apns-expiration": String(Math.floor(Date.now() / 1000) + HORECA_PUSH_TTL_SECONDS) },
                  payload: { aps: { sound: "default" } },
                },
                android: { ttl: `${HORECA_PUSH_TTL_SECONDS}s`, notification: { sound: "default", tag: msg.tag } },
              },
            }),
          });
          if (res.ok) fcmSent++;
          else {
            fcmFailed++;
            const errBody = await res.text();
            if (res.status === 404 || res.status === 410) stale.push(d.token);
            console.error(`FCM send failed (${res.status}): ${errBody}`);
          }
        } catch (e) {
          fcmFailed++;
          console.error("FCM send threw:", e instanceof Error ? e.message : String(e));
        }
      }
    }

    let cleaned = 0;
    if (stale.length > 0) {
      const { error: delErr } = await supabase.from("device_tokens").delete().in("token", stale);
      if (delErr) console.error("stale token cleanup failed:", delErr.message);
      else cleaned = stale.length;
    }
    return json({ event, web_sent: webSent, web_failed: webFailed, sent: fcmSent, failed: fcmFailed, cleaned });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Error in horeca-device-push:", msg);
    return json({ error: msg }, 500);
  }
});
