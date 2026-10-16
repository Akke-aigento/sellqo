// SOCIAL-1 — de scheduler voor social posts.
//
// Aangeroepen door twee cronjobs (migratie 20261015170000), allebei met x-cron-secret:
//   - social-publish-due-hourly  body {"mode":"publish"}: publiceert posts met status
//     'scheduled' (door de tenant ingepland) of 'approved' (goedgekeurd) waarvan
//     scheduled_for voorbij is.
//   - social-token-refresh-daily body {"mode":"refresh"}: ververst Instagram Login-tokens
//     die binnen 10 dagen verlopen.
// SOCIAL-3: mode "publish" stuurt ook de herinneringen voor posts op 'manual' (story met
// sticker, reel met eigen muziek): één melding (bel + push) per post, ±1 uur vooraf.
// Reels: de video gaat naar de eigen opslag; verwerkt Instagram hem binnen de run nog niet,
// dan blijft de container bewaard en publiceert de volgende run hem.
// Handmatig (zelfde secret): {"mode":"prepare","tenantId":…,"imageUrls":[…]} zet beelden
// om voor Instagram zonder te posten (droogtest, SOCIAL-1c).
// De cron roept deze functie enkel aan als er werk is (WHERE EXISTS in het cron-commando).
//
// Retry: een tijdelijke fout (netwerk, rate limit, 5xx) zet de post terug op zijn
// vorige status; de claim-functie pakt hem pas na 50 minuten opnieuw op. Na 3 pogingen,
// of meteen bij een blijvende fout (token ongeldig, geen beeld, geen pagina), wordt de
// post 'failed' en krijgt de tenant een melding.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { isAuthorizedCronRequest, CRON_ALLOWED_HEADERS } from "../_shared/cronAuth.ts";
import { loadBillingState } from "../_shared/billingGuard.ts";
import { WRITE_BLOCKED_STATES } from "../_shared/billingState.ts";
import { refreshInstagramToken } from "../_shared/socialPublish.ts";
import { prepareInstagramImages } from "../_shared/socialMedia.ts";
import { runClaimedPost, type ClaimedPost } from "../_shared/socialRunner.ts";
import { manualReminderText } from "../_shared/socialReminder.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": CRON_ALLOWED_HEADERS,
};

/** Host van de eigen opslag: beelden van elders worden naar SellQo gekopieerd (SOCIAL-2). */
const OWN_HOST = new URL(Deno.env.get("SUPABASE_URL") ?? "http://localhost").host;


function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

async function publishDue(admin: Admin) {
  const { data, error } = await admin.rpc("social_claim_due_posts", { p_limit: 20 });
  if (error) throw new Error(`claim mislukt: ${error.message}`);
  const posts = (data ?? []) as ClaimedPost[];

  const summary = { claimed: posts.length, posted: 0, retry: 0, failed: 0 };
  const billingCache = new Map<string, boolean>();

  for (const post of posts) {
    // Winkel in leesmodus (onbetaald): niet publiceren.
    if (!billingCache.has(post.tenant_id)) {
      const state = await loadBillingState(admin, post.tenant_id);
      billingCache.set(post.tenant_id, WRITE_BLOCKED_STATES.includes(state));
    }
    const outcome = await runClaimedPost(admin, post, { ownHost: OWN_HOST, billingBlocked: billingCache.get(post.tenant_id) });
    if (outcome.status === "posted") summary.posted++;
    else if (outcome.status === "failed") summary.failed++;
    else summary.retry++;
  }

  return summary;
}

interface ManualPost {
  id: string;
  tenant_id: string;
  media_type: string | null;
  manual_reason: string | null;
  post_text: string | null;
  scheduled_for: string;
}

/** SOCIAL-3: één herinnering per manual-post, ±1 uur vóór het geplande moment. */
async function remindManual(admin: Admin) {
  const now = Date.now();
  const { data, error } = await admin
    .from("social_posts")
    .select("id, tenant_id, media_type, manual_reason, post_text, scheduled_for")
    .eq("status", "manual")
    .is("reminded_at", null)
    .gte("scheduled_for", new Date(now - 30 * 60 * 1000).toISOString())
    .lte("scheduled_for", new Date(now + 65 * 60 * 1000).toISOString())
    .limit(50);
  if (error) throw new Error(`herinneringen lezen mislukt: ${error.message}`);

  let reminded = 0;
  for (const post of (data ?? []) as ManualPost[]) {
    // Eerst afvinken (voorwaardelijk), dan melden: zo kan een tweede run nooit dubbel melden.
    const { data: marked } = await admin
      .from("social_posts")
      .update({ reminded_at: new Date().toISOString() })
      .eq("id", post.id)
      .is("reminded_at", null)
      .select("id");
    if (!marked || marked.length === 0) continue;

    const { title, message } = manualReminderText(post);
    const { error: insertError } = await admin.from("notifications").insert({
      tenant_id: post.tenant_id,
      category: "marketing",
      type: "social_manual_due",
      priority: "medium",
      title,
      message,
      action_url: "/admin/marketing/social",
      data: { social_post_id: post.id, media_type: post.media_type },
    });
    if (insertError) {
      // SOCIAL-SEC-1: afvinken terugdraaien, anders is de herinnering voorgoed weg
      // (reminded_at gezet zonder melding). De volgende run binnen het venster probeert opnieuw.
      console.error("[social-publish-due] herinnering mislukt:", insertError.message);
      const { error: undoError } = await admin
        .from("social_posts")
        .update({ reminded_at: null })
        .eq("id", post.id);
      if (undoError) console.error("[social-publish-due] reminded_at terugzetten mislukt:", undoError.message);
      continue;
    }
    reminded++;
  }
  return { reminded };
}

async function refreshTokens(admin: Admin) {
  const soon = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await admin
    .from("social_connections")
    .select("id, tenant_id, access_token, token_expires_at, updated_at")
    .eq("api_kind", "instagram_login")
    .eq("is_active", true)
    .gt("token_expires_at", new Date().toISOString())
    .lt("token_expires_at", soon)
    .lt("updated_at", dayAgo);
  if (error) throw new Error(`tokens lezen mislukt: ${error.message}`);

  const summary = { candidates: (data ?? []).length, refreshed: 0, failed: 0 };
  for (const conn of data ?? []) {
    const r = await refreshInstagramToken(conn.access_token);
    if (r.ok) {
      summary.refreshed++;
      await admin.from("social_connections").update({
        access_token: r.token,
        token_expires_at: r.expiresAt,
        updated_at: new Date().toISOString(),
      }).eq("id", conn.id);
    } else {
      summary.failed++;
      console.error(`[social-publish-due] token-refresh mislukt voor connectie ${conn.id}: ${r.error}`);
    }
  }
  return summary;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // EDGE-IMPORT-1: neveneffectvrije versiestempel om een deploy na te meten.
  if (req.method === "GET") return json({ ok: true, version: "SOCIAL-SEC-1" });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!(await isAuthorizedCronRequest(req, admin))) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  let mode = "publish";
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = null;
  try {
    body = await req.json();
    if (body?.mode === "refresh") mode = "refresh";
    if (body?.mode === "prepare") mode = "prepare";
  } catch {
    // lege body = publish
  }

  try {
    // mode "prepare" (SOCIAL-1c): droogtest van de Instagram-beeldvoorbereiding op echte
    // URL's, zonder iets te posten. Enkel met het cron-secret (zie hierboven).
    if (mode === "prepare") {
      const tenantId = String(body?.tenantId ?? "");
      const urls = Array.isArray(body?.imageUrls) ? body.imageUrls.map(String) : [];
      if (!tenantId || urls.length === 0) return json({ success: false, error: "tenantId en imageUrls verplicht" }, 400);
      const prepared = await prepareInstagramImages(admin, tenantId, urls, { ownHost: OWN_HOST });
      return json({ success: prepared.ok, mode, ...prepared });
    }
    const result = mode === "refresh"
      ? await refreshTokens(admin)
      : { ...(await publishDue(admin)), ...(await remindManual(admin)) };
    console.log(`[social-publish-due] ${mode}`, JSON.stringify(result));
    return json({ success: true, mode, ...result });
  } catch (err) {
    console.error("[social-publish-due] fout:", (err as Error).message);
    return json({ success: false, error: (err as Error).message }, 500);
  }
});
