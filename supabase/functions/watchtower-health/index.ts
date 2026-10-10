// WATCHTOWER-HEALTH-1 — read-only health-endpoint voor Nomadix Watchtower.
//
// GET met header x-health-token. Het token staat in internal_config
// (key 'watchtower_health_token'; RLS aan zonder policies, alleen service-role).
// Antwoordt in het Watchtower-health-contract:
//   { status: 'ok'|'warn'|'fail', generated_at, checks: [{ key, status, detail }] }
//
// Raakt niets van de storefront-paden en schrijft niets.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-health-token",
};

type Status = "ok" | "warn" | "fail";
type Check = { key: string; status: Status; detail: string };
const RANK: Record<Status, number> = { ok: 0, warn: 1, fail: 2 };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function constantTimeEquals(a: string, b: string): boolean {
  let mismatch = a.length !== b.length ? 1 : 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// deno-lint-ignore no-explicit-any
export function evaluate(s: any): Check[] {
  const checks: Check[] = [];

  const http = s.cron_http_errors ?? {};
  checks.push({
    key: "cron_http",
    status: (http.count ?? 0) >= 3 ? "fail" : (http.count ?? 0) > 0 ? "warn" : "ok",
    detail: http.count ? `${http.count} cron-aanroep(en) zonder 2xx in 6 u — ${http.example ?? ""}` : "alle cron-aanroepen 2xx (6 u)",
  });

  const failed = Array.isArray(s.cron_failed_jobs) ? s.cron_failed_jobs : [];
  checks.push({
    key: "cron_jobs",
    status: failed.length ? "fail" : "ok",
    detail: failed.length ? `laatste run faalde: ${failed.map((f: { job: string }) => f.job).join(", ")}` : "alle actieve cronjobs ok (24 u)",
  });

  const anomalies = Number(s.payment_anomalies_open ?? 0);
  checks.push({
    key: "payments",
    status: anomalies > 0 ? "fail" : "ok",
    detail: anomalies ? `${anomalies} betaling(en) op een al betaalde of gesloten post — terugbetalen?` : "geen betaalanomalieën",
  });

  const odoo = s.odoo_sync_errors ?? {};
  checks.push({
    key: "odoo_sync",
    status: (odoo.count ?? 0) > 0 ? "warn" : "ok",
    detail: odoo.count ? `${odoo.count} Odoo-boeking(en) niet gesynct (24 u): ${odoo.last_error ?? ""}` : "Odoo-sync ok (24 u)",
  });

  const mail = s.email ?? {};
  const stuck = Number(mail.stuck_pending ?? 0);
  const mailFailed = Number(mail.failed_24h ?? 0);
  checks.push({
    key: "email",
    status: mailFailed > 0 ? "fail" : stuck > 0 ? "warn" : "ok",
    detail:
      mailFailed || stuck
        ? `${mailFailed} mislukt/DLQ (24 u), ${stuck} hangt > 1 u op pending`
        : "geen mislukte of hangende mails",
  });

  const wh = Number(s.webhook_failures_24h ?? 0);
  checks.push({
    key: "webhooks",
    status: wh > 0 ? "warn" : "ok",
    detail: wh ? `${wh} tenant-webhook(s) faalden (24 u)` : "tenant-webhooks ok (24 u)",
  });

  return checks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: cfg, error: cfgErr } = await supabase
    .from("internal_config")
    .select("value")
    .eq("key", "watchtower_health_token")
    .maybeSingle();
  if (cfgErr || !cfg?.value) return json({ error: "Health token not configured" }, 500);
  const provided = req.headers.get("x-health-token") ?? "";
  if (!constantTimeEquals(provided, String(cfg.value))) return json({ error: "Unauthorized" }, 401);

  const { data: snapshot, error } = await supabase.rpc("watchtower_health_snapshot");
  if (error) {
    return json({
      status: "fail",
      generated_at: new Date().toISOString(),
      checks: [{ key: "snapshot", status: "fail", detail: error.message }],
    });
  }

  const checks = evaluate(snapshot);
  const status = checks.reduce<Status>((acc, c) => (RANK[c.status] > RANK[acc] ? c.status : acc), "ok");
  return json({
    status,
    generated_at: new Date().toISOString(),
    checks,
    context: { last_paid_order_at: snapshot?.last_paid_order_at ?? null },
  });
});
