// SOCIAL-5 — resultaten van social posts ophalen voor de tab "Resultaten" in de Social planning
// en voor de weektaken die daarmee de posttijden kiezen.
//
// Aangeroepen door de cronjob social-insights-sync (elke 3 uur, x-cron-secret). Per actieve
// Instagram-koppeling (Instagram Login):
//   1. volgers en aantal posts van vandaag → social_account_stats (één rij per dag);
//   2. de laatste 50 feed-posts en reels → zelf geplaatste posts ("Gepost") koppelen op tijdstip;
//   3. per geposte post de cijfers → social_posts.engagement_data (alleen die kolom).
// Zonder de toestemming instagram_business_manage_insights (nog niet opnieuw gekoppeld) vallen
// we terug op likes en reacties uit de medialijst (source "basic").
//
// Schrijft nooit status, tijdstip of tekst van een post. Handmatig testen (zelfde secret):
// POST {"tenantId": "..."} beperkt de run tot één winkel.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { isAuthorizedCronRequest, CRON_ALLOWED_HEADERS } from "../_shared/cronAuth.ts";
import {
  basicMetrics, fetchMediaInsights, fetchRecentMedia, igGet, matchMedia, needsRefresh,
  type EngagementData, type IgMedia, type OurMediaType,
} from "../_shared/socialInsights.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": CRON_ALLOWED_HEADERS,
};

const VERSION = "SOCIAL-5";
const MAX_POSTS_PER_CONNECTION = 60;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

interface Connection {
  id: string;
  tenant_id: string;
  account_id: string;
  access_token: string;
}

interface PostRow {
  id: string;
  media_type: string;
  posted_at: string | null;
  scheduled_for: string | null;
  platform_post_id: string | null;
  engagement_data: Partial<EngagementData> | null;
}

const brusselsDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(d);

async function syncConnection(admin: Admin, conn: Connection) {
  const summary = { tenant: conn.tenant_id, followers: null as number | null, matched: 0, measured: 0, basic: 0, low: 0, errors: 0, insights: true };

  // 1. Account: volgers en aantal posts.
  const acc = await igGet(conn.account_id, conn.access_token, { fields: "followers_count,media_count" });
  if (acc.ok) {
    const followers = Number(acc.json.followers_count);
    const mediaCount = Number(acc.json.media_count);
    summary.followers = Number.isFinite(followers) ? followers : null;
    const { error } = await admin.from("social_account_stats").upsert({
      tenant_id: conn.tenant_id,
      platform: "instagram",
      captured_on: brusselsDate(),
      followers_count: Number.isFinite(followers) ? followers : null,
      media_count: Number.isFinite(mediaCount) ? mediaCount : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,platform,captured_on" });
    if (error) console.error(`[social-insights-sync] stats ${conn.tenant_id}: ${error.message}`);
  } else {
    console.error(`[social-insights-sync] account ${conn.tenant_id}: ${acc.error.message}`);
    summary.errors++;
    return summary; // token stuk: de rest lukt ook niet
  }

  // 2. Geposte posts van de laatste 35 dagen.
  const since = new Date(Date.now() - 35 * 24 * 3600 * 1000).toISOString();
  const { data: rows, error } = await admin
    .from("social_posts")
    .select("id, media_type, posted_at, scheduled_for, platform_post_id, engagement_data")
    .eq("tenant_id", conn.tenant_id)
    .eq("platform", "instagram")
    .eq("status", "posted")
    .gte("posted_at", since)
    .order("posted_at", { ascending: false })
    .limit(MAX_POSTS_PER_CONNECTION);
  if (error) throw new Error(`posts lezen mislukt: ${error.message}`);
  const posts = (rows ?? []) as PostRow[];
  if (posts.length === 0) return summary;

  let media: IgMedia[] = [];
  try {
    media = await fetchRecentMedia(conn.access_token, conn.account_id);
  } catch (err) {
    console.error(`[social-insights-sync] media ${conn.tenant_id}: ${(err as Error).message}`);
  }
  const mediaById = new Map(media.map((m) => [m.id, m]));
  const mediaIdOf = (p: PostRow) => p.platform_post_id ?? p.engagement_data?.media_id ?? null;

  // Zelf geplaatste posts koppelen (stories staan niet in de medialijst).
  const taken = new Set(posts.map(mediaIdOf).filter(Boolean) as string[]);
  const unmatched = posts.filter((p) => !mediaIdOf(p) && p.media_type !== "story");
  const matches = matchMedia(unmatched, media, taken);

  for (const post of posts) {
    const matched = matches.get(post.id);
    const mediaId = mediaIdOf(post) ?? matched?.id ?? null;
    if (!mediaId) continue;
    const isNewMatch = !!matched && !mediaIdOf(post);
    if (!isNewMatch && !needsRefresh(post.media_type, post.posted_at, post.engagement_data?.fetched_at)) continue;

    const type = (["image", "carousel", "reel", "story"].includes(post.media_type) ? post.media_type : "image") as OurMediaType;
    const listed = mediaById.get(mediaId);
    const base: EngagementData = {
      media_id: mediaId,
      permalink: listed?.permalink ?? post.engagement_data?.permalink ?? null,
      fetched_at: new Date().toISOString(),
      source: "insights",
      matched: isNewMatch || !!post.engagement_data?.matched,
      metrics: {},
    };

    let data: EngagementData | null = null;
    if (summary.insights) {
      const r = await fetchMediaInsights(conn.access_token, mediaId, type);
      if (r.kind === "ok") data = { ...base, metrics: { ...(listed ? basicMetrics(listed) : {}), ...r.metrics } };
      else if (r.kind === "low_volume") { data = { ...base, low_volume: true }; summary.low++; }
      else if (r.kind === "no_permission") summary.insights = false;
      else { summary.errors++; console.error(`[social-insights-sync] ${post.id}: ${r.error}`); }
    }
    if (!data && !summary.insights && listed) {
      data = { ...base, source: "basic", metrics: basicMetrics(listed) };
      summary.basic++;
    }
    if (!data) continue;

    const { error: upErr } = await admin.from("social_posts").update({ engagement_data: data }).eq("id", post.id).eq("status", "posted");
    if (upErr) { summary.errors++; console.error(`[social-insights-sync] update ${post.id}: ${upErr.message}`); continue; }
    if (isNewMatch) summary.matched++;
    if (data.source === "insights" && !data.low_volume) summary.measured++;
  }
  return summary;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // Neveneffectvrije versiestempel om een deploy na te meten.
  if (req.method === "GET") return json({ ok: true, version: VERSION });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!(await isAuthorizedCronRequest(req, admin))) return json({ success: false, error: "Unauthorized" }, 401);

  let tenantId: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.tenantId === "string") tenantId = body.tenantId;
  } catch {
    // lege body = alle winkels
  }

  try {
    let q = admin
      .from("social_connections")
      .select("id, tenant_id, account_id, access_token")
      .eq("platform", "instagram")
      .eq("api_kind", "instagram_login")
      .eq("is_active", true)
      .gt("token_expires_at", new Date().toISOString());
    if (tenantId) q = q.eq("tenant_id", tenantId);
    const { data, error } = await q;
    if (error) throw new Error(`koppelingen lezen mislukt: ${error.message}`);

    const results = [];
    for (const conn of (data ?? []) as Connection[]) {
      if (!conn.account_id || !conn.access_token) continue;
      try {
        results.push(await syncConnection(admin, conn));
      } catch (err) {
        console.error(`[social-insights-sync] ${conn.tenant_id}: ${(err as Error).message}`);
        results.push({ tenant: conn.tenant_id, error: (err as Error).message });
      }
    }
    console.log("[social-insights-sync]", JSON.stringify(results));
    return json({ success: true, version: VERSION, results });
  } catch (err) {
    console.error("[social-insights-sync] fout:", (err as Error).message);
    return json({ success: false, error: (err as Error).message }, 500);
  }
});
