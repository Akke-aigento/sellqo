import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

async function getFcmAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(`Google OAuth token exchange failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.access_token as string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // 2. Is push enabled for this tenant + category?
    const { data: settings } = await supabase
      .from("tenant_notification_settings")
      .select("push_enabled")
      .eq("tenant_id", payload.tenant_id)
      .eq("category", payload.category)
      .eq("notification_type", payload.type)
      .maybeSingle();

    if (!settings || settings.push_enabled !== true) {
      return json({ skipped: true, reason: "push_disabled" });
    }

    // 3. Target users: an explicit user_id targets one person, otherwise every
    //    user with a role in this tenant (same resolution as the in-app row).
    let targetUsers: string[] = [];
    if (payload.user_id) {
      targetUsers = [payload.user_id];
    } else {
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", payload.tenant_id);
      if (rolesErr) throw rolesErr;
      targetUsers = [...new Set((roles ?? []).map((r: { user_id: string }) => r.user_id))];
    }

    if (targetUsers.length === 0) {
      return json({ skipped: true, reason: "no_target_users" });
    }

    // 4. Devices
    const { data: devices, error: devErr } = await supabase
      .from("device_tokens")
      .select("token, platform")
      .in("user_id", targetUsers);
    if (devErr) throw devErr;

    if (!devices || devices.length === 0) {
      return json({ skipped: true, reason: "no_devices" });
    }

    // 5. Firebase credentials — graceful degradation, never a crash.
    const rawSa = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!rawSa) {
      console.error("FIREBASE_SERVICE_ACCOUNT not configured");
      return json({ skipped: true, reason: "firebase_not_configured" });
    }

    let sa: ServiceAccount;
    try {
      sa = JSON.parse(rawSa) as ServiceAccount;
    } catch {
      console.error("FIREBASE_SERVICE_ACCOUNT not configured (invalid JSON)");
      return json({ skipped: true, reason: "firebase_not_configured" });
    }
    if (!sa.project_id || !sa.client_email || !sa.private_key) {
      console.error("FIREBASE_SERVICE_ACCOUNT not configured (missing fields)");
      return json({ skipped: true, reason: "firebase_not_configured" });
    }

    let accessToken: string;
    try {
      accessToken = await getFcmAccessToken(sa);
    } catch (e) {
      console.error("FCM auth failed:", e instanceof Error ? e.message : String(e));
      return json({ skipped: true, reason: "fcm_auth_failed" });
    }

    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
    const dataPayload: Record<string, string> = {
      notification_id: payload.notification_id ?? "",
      action_url: payload.action_url ?? "",
      category: payload.category,
      type: payload.type,
      tenant_id: payload.tenant_id,
    };

    let sent = 0;
    let failed = 0;
    const staleTokens: string[] = [];

    for (const device of devices as Array<{ token: string; platform: string }>) {
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
              notification: { title: payload.title, body: payload.message },
              data: dataPayload,
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

    // 6. Token rotation cleanup
    let cleaned = 0;
    if (staleTokens.length > 0) {
      const { error: delErr } = await supabase
        .from("device_tokens")
        .delete()
        .in("token", staleTokens);
      if (delErr) {
        console.error("Failed to clean stale device tokens:", delErr.message ?? JSON.stringify(delErr));
      } else {
        cleaned = staleTokens.length;
      }
    }

    console.log(`push result: sent=${sent} failed=${failed} cleaned=${cleaned} notification=${payload.notification_id ?? "n/a"}`);
    return json({ sent, failed, cleaned });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("Error in send-push-notification:", msg);
    return json({ error: msg }, 500);
  }
});