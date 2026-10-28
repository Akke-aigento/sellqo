import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolvePushEnabled } from "../_shared/notificationDefaults.ts";
import { notificationRoute } from "../_shared/notificationRoutes.ts";
import { sendWebPush } from "../_shared/webpush.ts";
import { getFcmAccessToken, type ServiceAccount } from "../_shared/fcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

interface PushRequest {
  notification_id?: string;
  tenant_id: string;
  category: string;
  type: string;
  title: string;
  message: string;
  action_url?: string | null;
  data?: Record<string, unknown> | null;
  user_id?: string | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  // Versiestempel om een herdeploy zonder neveneffect na te meten (SUB-UNIFY-2A; nu MELDING-1b). Geen auth, geen data.
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, version: "MELDING-1b" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Internal-secret auth (mirrors create-notification's internal path)
    const internalSecret = req.headers.get("X-Internal-Secret")?.trim();
    const { data: secretRow } = await supabase
      .from("internal_config")
      .select("value")
      .eq("key", "internal_webhook_secret")
      .maybeSingle();
    const expected = (secretRow?.value as string | undefined)?.trim();
    if (!internalSecret || !expected || internalSecret !== expected) {
      return json({ error: "Unauthorized internal call" }, 401);
    }

    const payload: PushRequest = await req.json();
    if (!payload?.tenant_id || !payload?.category) {
      return json({ error: "tenant_id and category are required" }, 400);
    }

    // 2. Ontvangers. PUSH-2 (13 sep): push is persoonlijk, per gebruiker; de
    //    winkelkolom tenant_notification_settings.push_enabled wordt niet gelezen.
    if (!payload.type) {
      return json({ error: "type is required" }, 400);
    }
    // PUSH-DEFAULT-1 (18 sep 2026): opt-out in plaats van opt-in. Tot dan telde
    // alleen wie een eigen rij "aan" had; een ontbrekende rij was "uit", en push kwam
    // daardoor nergens aan. Nu: kandidaten = iedereen met een rol in de winkel, plus
    // wie hier zelf een rij "aan" heeft (platform-admins). Per persoon beslist de eigen
    // rij; zonder rij resolvePushEnabled (_shared/notificationDefaults.ts): aan voor
    // teamleden, uit voor een platform-admin zonder rol in deze winkel.
    const [{ data: prefs, error: prefsErr }, { data: memberRows, error: membersErr }] = await Promise.all([
      supabase
        .from("user_notification_preferences")
        .select("user_id, push_enabled")
        .eq("tenant_id", payload.tenant_id)
        .eq("category", payload.category)
        .eq("notification_type", payload.type),
      supabase
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", payload.tenant_id),
    ]);
    if (prefsErr) throw prefsErr;
    if (membersErr) throw membersErr;

    const prefByUser = new Map<string, { push_enabled: boolean }>();
    for (const p of (prefs ?? []) as Array<{ user_id: string; push_enabled: boolean }>) {
      prefByUser.set(p.user_id, { push_enabled: p.push_enabled });
    }
    const tenantMembers = new Set((memberRows ?? []).map((r: { user_id: string }) => r.user_id));

    let candidates = [...new Set([...tenantMembers, ...prefByUser.keys()])].filter((id) =>
      resolvePushEnabled(prefByUser.get(id), { isTenantMember: tenantMembers.has(id) })
    );
    // Een melding voor één persoon gaat alleen naar die persoon, en alleen als
    // push voor hem aan staat.
    if (payload.user_id) {
      candidates = candidates.filter((id) => id === payload.user_id);
    }
    if (candidates.length === 0) {
      return json({ skipped: true, reason: "push_disabled" });
    }

    // 3. Een voorkeur is geen toegang. Wie uit het team gehaald is, kan nog een
    //    rij hebben staan; die krijgt niets. Ontvanger is wie een rol heeft in
    //    deze winkel, of platform-admin is — die mag zich op elke winkel
    //    abonneren (keuze van Akke).
    //
    //    Daarna de rol: push volgt dezelfde regel als het belletje, via de
    //    SQL-functie can_read_notification_category (NOTIF-RLS-1).
    const { data: candidateRoles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("user_id, tenant_id, role")
      .in("user_id", candidates);
    if (rolesErr) throw rolesErr;

    const rolesPerUser = new Map<string, Array<{ tenant_id: string | null; role: string }>>();
    for (const r of (candidateRoles ?? []) as Array<{ user_id: string; tenant_id: string | null; role: string }>) {
      const list = rolesPerUser.get(r.user_id) ?? [];
      list.push(r);
      rolesPerUser.set(r.user_id, list);
    }

    const members = candidates.filter((id) =>
      (rolesPerUser.get(id) ?? []).some((r) =>
        r.tenant_id === payload.tenant_id || r.role === "platform_admin"
      )
    );

    const targetUsers: string[] = [];
    for (const userId of members) {
      const { data: allowed, error: canErr } = await supabase.rpc("can_read_notification_category", {
        _user_id: userId,
        _tenant_id: payload.tenant_id,
        _category: payload.category,
      });
      // Bij twijfel geen push: een gemiste melding staat nog in het belletje,
      // een onterechte staat op iemands vergrendelscherm.
      if (canErr) {
        console.error("can_read_notification_category failed:", canErr.message);
        continue;
      }
      if (allowed === true) targetUsers.push(userId);
    }

    if (targetUsers.length === 0) {
      return json({ skipped: true, reason: "no_target_users" });
    }

    // 4. Devices
    // MELDING-1: install_id is nieuw. Bestaat de kolom (nog) niet, dan zonder lezen: een deploy vóór
    // de migratie mag de persoonlijke pushes van geen enkele winkel breken.
    type TokenRow = { token: string; platform: string; user_id: string; p256dh: string | null; auth: string | null; install_id?: string | null };
    const first = await supabase
      .from("device_tokens")
      .select("token, platform, user_id, p256dh, auth, install_id")
      .in("user_id", targetUsers);
    let rawDevices = first.data as TokenRow[] | null;
    let devErr = first.error;
    if (devErr && (devErr as { code?: string }).code === "42703") {
      const fallback = await supabase
        .from("device_tokens")
        .select("token, platform, user_id, p256dh, auth")
        .in("user_id", targetUsers);
      rawDevices = fallback.data as TokenRow[] | null;
      devErr = fallback.error;
    }
    if (devErr) throw devErr;

    // MELDING-1: een gedeeld toestel van DEZE zaak (kassa, keukenscherm) met "persoonlijke meldingen uit"
    // krijgt de meldingen van de aangemelde gebruiker niet; enkel zijn horeca-meldingen
    // (horeca-device-push). Per zaak: een profiel bij zaak A mag de meldingen van zaak B nooit stilzetten.
    // Lukt het opzoeken niet, dan geen filter (liever een melding te veel dan geen enkele).
    const installIds = [...new Set((rawDevices ?? []).map((d: { install_id?: string | null }) => d.install_id).filter((x): x is string => !!x))];
    let sharedInstalls = new Set<string>();
    if (installIds.length > 0) {
      const { data: shared, error: sharedErr } = await supabase
        .from("horeca_notify_devices")
        .select("install_id")
        .eq("tenant_id", payload.tenant_id)
        .in("install_id", installIds)
        .eq("personal", false);
      if (sharedErr) console.error("horeca_notify_devices lookup failed (no filter applied):", sharedErr.message);
      else sharedInstalls = new Set((shared ?? []).map((r: { install_id: string }) => r.install_id));
    }
    const devices = (rawDevices ?? []).filter((d: { install_id?: string | null }) => !d.install_id || !sharedInstalls.has(d.install_id));

    if (devices.length === 0) {
      return json({ skipped: true, reason: "no_devices" });
    }

    // 4b. Wie ontvangt van meer dan één winkel?
    //
    // Een toestel-token hangt aan een telefoon, niet aan een winkel. Wie rollen
    // heeft in VanXcel én Loveke krijgt meldingen van allebei op hetzelfde
    // toestel, en zag tot 13 september 2026 niet van welke. Het voorvoegsel komt
    // er alleen voor wie meerdere winkels heeft; wie één shop beheert zou de
    // naam als ruis ervaren. Een platform-admin telt altijd als meervoudig: die
    // kan zich op elke winkel abonneren.
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", payload.tenant_id)
      .maybeSingle();
    const tenantName = (tenantRow?.name as string | undefined) ?? null;

    const multiTenantUsers = new Set<string>();
    for (const userId of targetUsers) {
      const list = rolesPerUser.get(userId) ?? [];
      const tenants = new Set(list.map((r) => r.tenant_id).filter((id): id is string => id !== null));
      if (tenants.size > 1 || list.some((r) => r.role === "platform_admin")) {
        multiTenantUsers.add(userId);
      }
    }

    type DeviceRow = { token: string; platform: string; user_id: string; p256dh: string | null; auth: string | null };
    const allDevices = devices as DeviceRow[];
    const fcmDevices = allDevices.filter((d) => d.platform !== "web");
    const webDevices = allDevices.filter((d) => d.platform === "web");

    const titleFor = (userId: string) =>
      tenantName && multiTenantUsers.has(userId) ? `${tenantName} · ${payload.title}` : payload.title;
    // NOTIF-DEEPLINK-1: de route uit het gedeelde register, niet de rauwe action_url.
    const route = notificationRoute(payload);
    const staleTokens: string[] = [];

    // 4c. WEBPUSH-1 — web-abonnementen (beginscherm-webapp / browser). Vóór FCM,
    //     zodat een FCM-storing of ontbrekende Firebase-config web niet meesleept.
    //     De private VAPID-sleutel staat in internal_config (alleen service role).
    let webSent = 0;
    let webFailed = 0;
    if (webDevices.length > 0) {
      const { data: vapidRow } = await supabase
        .from("internal_config")
        .select("value")
        .eq("key", "vapid_private_jwk")
        .maybeSingle();
      let vapidJwk: JsonWebKey | null = null;
      try {
        vapidJwk = vapidRow?.value ? (JSON.parse(vapidRow.value as string) as JsonWebKey) : null;
      } catch {
        vapidJwk = null;
      }
      if (!vapidJwk) {
        console.error("vapid_private_jwk not configured — web push skipped");
      } else {
        for (const device of webDevices) {
          if (!device.p256dh || !device.auth) {
            webFailed++;
            continue;
          }
          const result = await sendWebPush(
            { endpoint: device.token, p256dh: device.p256dh, auth: device.auth },
            {
              title: titleFor(device.user_id),
              body: payload.message,
              url: route,
              tag: payload.notification_id ?? undefined,
            },
            vapidJwk,
          );
          if (result.status >= 200 && result.status < 300) {
            webSent++;
          } else {
            webFailed++;
            if (result.gone) staleTokens.push(device.token);
            console.error(`web push failed (${result.status}): ${result.error ?? ""}`);
          }
        }
      }
    }

    // Opruimen van dode tokens/endpoints — gedeeld door web en FCM.
    const cleanStale = async (): Promise<number> => {
      if (staleTokens.length === 0) return 0;
      const { error: delErr } = await supabase
        .from("device_tokens")
        .delete()
        .in("token", staleTokens);
      if (delErr) {
        console.error("Failed to clean stale device tokens:", delErr.message ?? JSON.stringify(delErr));
        return 0;
      }
      return staleTokens.length;
    };
    // FCM kan niet (of hoeft niet): geef het web-resultaat terug.
    const webOnly = async (reason: string) => {
      const cleaned = await cleanStale();
      if (fcmDevices.length > 0) console.error(`FCM skipped: ${reason}`);
      return json({
        ...(fcmDevices.length > 0 ? { reason } : {}),
        sent: 0, failed: 0, web_sent: webSent, web_failed: webFailed, cleaned,
      });
    };

    if (fcmDevices.length === 0) {
      return await webOnly("no_fcm_devices");
    }

    // 5. Firebase credentials — graceful degradation, never a crash.
    const rawSa = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!rawSa) {
      console.error("FIREBASE_SERVICE_ACCOUNT not configured");
      return await webOnly("firebase_not_configured");
    }

    let sa: ServiceAccount;
    try {
      sa = JSON.parse(rawSa) as ServiceAccount;
    } catch {
      console.error("FIREBASE_SERVICE_ACCOUNT not configured (invalid JSON)");
      return await webOnly("firebase_not_configured");
    }
    if (!sa.project_id || !sa.client_email || !sa.private_key) {
      console.error("FIREBASE_SERVICE_ACCOUNT not configured (missing fields)");
      return await webOnly("firebase_not_configured");
    }

    let accessToken: string;
    try {
      accessToken = await getFcmAccessToken(sa);
    } catch (e) {
      console.error("FCM auth failed:", e instanceof Error ? e.message : String(e));
      return await webOnly("fcm_auth_failed");
    }

    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
    const dataPayload: Record<string, string> = {
      notification_id: payload.notification_id ?? "",
      // NOTIF-DEEPLINK-1: de route uit het gedeelde register (type + data), niet
      // de rauwe action_url — die wijst in ruim de helft van de bronnen naar een
      // pagina die niet bestaat. De app vertaalt oude payloads zelf ook nog.
      action_url: route,
      category: payload.category,
      type: payload.type,
      tenant_id: payload.tenant_id,
    };

    let sent = 0;
    let failed = 0;

    for (const device of fcmDevices) {
      const title = titleFor(device.user_id);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: device.token,
              notification: { title, body: payload.message },
              data: dataPayload,
              // Geluid moet per bericht gevraagd worden. Zonder `sound` kwam de
              // melding op iOS stil binnen (vastgesteld bij de eerste echte
              // push, 13 sep 2026). "default" is het systeemgeluid; de
              // gebruiker kan het nog altijd uitzetten in de telefooninstellingen.
              apns: { payload: { aps: { sound: "default" } } },
              android: { notification: { sound: "default" } },
            },
          }),
        });

        if (res.ok) {
          sent++;
        } else {
          failed++;
          const errBody = await res.text();
          if (res.status === 404 || res.status === 410) {
            staleTokens.push(device.token);
          }
          console.error(`FCM send failed (${res.status}) platform=${device.platform}: ${errBody}`);
        }
      } catch (e) {
        failed++;
        console.error("FCM send threw:", e instanceof Error ? e.message : String(e));
      }
    }

    // 6. Token rotation cleanup (web + FCM)
    const cleaned = await cleanStale();

    console.log(`push result: sent=${sent} failed=${failed} web_sent=${webSent} web_failed=${webFailed} cleaned=${cleaned} notification=${payload.notification_id ?? "n/a"}`);
    return json({ sent, failed, web_sent: webSent, web_failed: webFailed, cleaned });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Error in send-push-notification:", msg);
    return json({ error: msg }, 500);
  }
});