// SOCIAL-5 — resultaten van Instagram-posts ophalen (Instagram API met Instagram Login).
//
// Twee niveaus:
//   - "insights" (toestemming instagram_business_manage_insights): bereik, weergaven,
//     likes, reacties, bewaard, gedeeld, interacties, volgers via de post, ...
//   - "basic" (enkel instagram_business_basic): likes en reacties uit de medialijst.
//     Zo zijn er al cijfers vóór een winkel opnieuw koppelt met de nieuwe toestemming.
//
// Posts die Akke zelf in de app plaatste (status "Gepost", geen platform_post_id) koppelen we
// aan de juiste Instagram-media op basis van tijdstip en soort (matchMedia). Dat id gaat naar
// engagement_data.media_id; platform_post_id blijft onaangeroerd.
//
// Bronnen (okt 2026): developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights
// (metrics per mediatype; stories 24 u beschikbaar; "impressions" vervangen door "views").

import { GRAPH_VERSION } from "./socialPublish.ts";

export const IG_HOST = "https://graph.instagram.com";

export interface PostMetrics {
  reach?: number;
  views?: number;
  likes?: number;
  comments?: number;
  saved?: number;
  shares?: number;
  total_interactions?: number;
  follows?: number;
  profile_visits?: number;
  replies?: number;
  /** Reels: gemiddelde kijktijd in milliseconden. */
  avg_watch_time_ms?: number;
}

export interface EngagementData {
  media_id: string;
  permalink: string | null;
  fetched_at: string;
  /** "insights": volledige cijfers; "basic": enkel likes en reacties. */
  source: "insights" | "basic";
  /** true als de post zelf in de app geplaatst werd en we hem op tijdstip koppelden. */
  matched: boolean;
  /** Story met te weinig weergaven: Instagram geeft dan geen cijfers (onder 5). */
  low_volume?: boolean;
  metrics: PostMetrics;
}

export type OurMediaType = "image" | "carousel" | "reel" | "story";

/** Metrics per soort, volgens de Meta-documentatie. */
export const METRICS: Record<OurMediaType, string[]> = {
  image: ["reach", "views", "likes", "comments", "saved", "shares", "total_interactions", "follows", "profile_visits"],
  carousel: ["reach", "views", "likes", "comments", "saved", "shares", "total_interactions", "follows", "profile_visits"],
  reel: ["reach", "views", "likes", "comments", "saved", "shares", "total_interactions", "ig_reels_avg_watch_time"],
  story: ["reach", "views", "shares", "total_interactions", "replies", "follows"],
};

/** Kleinere set als de volledige vraag faalt (bv. een metric die voor dit item niet bestaat). */
export const FALLBACK_METRICS: Record<OurMediaType, string[]> = {
  image: ["reach", "likes", "comments", "saved", "shares"],
  carousel: ["reach", "likes", "comments", "saved", "shares"],
  reel: ["reach", "likes", "comments", "saved", "shares"],
  story: ["reach"],
};

const NAME_MAP: Record<string, keyof PostMetrics> = {
  reach: "reach",
  views: "views",
  likes: "likes",
  comments: "comments",
  saved: "saved",
  shares: "shares",
  total_interactions: "total_interactions",
  follows: "follows",
  profile_visits: "profile_visits",
  replies: "replies",
  ig_reels_avg_watch_time: "avg_watch_time_ms",
};

/** Zet het antwoord van /{media-id}/insights om naar PostMetrics. */
export function parseInsights(json: unknown): PostMetrics {
  const out: PostMetrics = {};
  const data = (json as { data?: unknown[] })?.data;
  if (!Array.isArray(data)) return out;
  for (const row of data as Array<{ name?: string; values?: Array<{ value?: unknown }>; total_value?: { value?: unknown } }>) {
    const key = row?.name ? NAME_MAP[row.name] : undefined;
    if (!key) continue;
    const raw = row.total_value?.value ?? row.values?.[0]?.value;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

export interface GraphFailure {
  code?: number;
  message: string;
  status: number;
}

/** Ontbrekende toestemming (nog niet opnieuw gekoppeld) of een ongeldig token. */
export function isPermissionError(err: GraphFailure): boolean {
  if (err.code === 190) return true; // token ongeldig of ingetrokken
  if (err.code === 10 || err.code === 200) return true;
  return /permission|not authorized|scope/i.test(err.message);
}

export async function igGet(
  path: string,
  token: string,
  params: Record<string, string> = {},
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; error: GraphFailure }> {
  const url = new URL(`${IG_HOST}/${GRAPH_VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    return { ok: false, error: { message: `Netwerkfout: ${(err as Error).message}`, status: 0 } };
  }
  let json: Record<string, unknown> = {};
  try {
    json = await response.json();
  } catch {
    // leeg
  }
  const e = json.error as { code?: number; message?: string; error_user_msg?: string } | undefined;
  if (!response.ok || e) {
    return { ok: false, error: { code: e?.code, message: e?.error_user_msg || e?.message || `HTTP ${response.status}`, status: response.status } };
  }
  return { ok: true, json };
}

export type InsightsOutcome =
  | { kind: "ok"; metrics: PostMetrics }
  | { kind: "low_volume" }
  | { kind: "no_permission"; error: string }
  | { kind: "error"; error: string };

/** Haalt de cijfers van één item op, met een kleinere metricset als terugvaloptie. */
export async function fetchMediaInsights(token: string, mediaId: string, type: OurMediaType): Promise<InsightsOutcome> {
  const first = await igGet(`${mediaId}/insights`, token, { metric: METRICS[type].join(",") });
  if (first.ok) return { kind: "ok", metrics: parseInsights(first.json) };
  // Story met minder dan 5 weergaven: Instagram antwoordt met code 10.
  if (type === "story" && first.error.code === 10 && !/permission/i.test(first.error.message)) return { kind: "low_volume" };
  if (isPermissionError(first.error)) return { kind: "no_permission", error: first.error.message };
  const second = await igGet(`${mediaId}/insights`, token, { metric: FALLBACK_METRICS[type].join(",") });
  if (second.ok) return { kind: "ok", metrics: parseInsights(second.json) };
  if (isPermissionError(second.error)) return { kind: "no_permission", error: second.error.message };
  return { kind: "error", error: second.error.message };
}

export interface IgMedia {
  id: string;
  timestamp: string;
  media_type?: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type?: string; // FEED | REELS | STORY
  permalink?: string;
  like_count?: number;
  comments_count?: number;
}

/** Laatste media van het account (stories zitten hier niet in; enkel feed en reels). */
export async function fetchRecentMedia(token: string, igUserId: string, limit = 50): Promise<IgMedia[]> {
  const r = await igGet(`${igUserId}/media`, token, {
    fields: "id,timestamp,media_type,media_product_type,permalink,like_count,comments_count",
    limit: String(limit),
  });
  if (!r.ok) throw new Error(r.error.message);
  return ((r.json.data as IgMedia[]) ?? []).filter((m) => m?.id && m?.timestamp);
}

export function mediaKind(m: IgMedia): OurMediaType | null {
  if (m.media_product_type === "STORY") return "story";
  if (m.media_product_type === "REELS") return "reel";
  if (m.media_type === "CAROUSEL_ALBUM") return "carousel";
  if (m.media_type === "IMAGE" || m.media_type === "VIDEO") return "image";
  return null;
}

export interface MatchCandidate {
  id: string;
  media_type: string;
  posted_at: string | null;
  scheduled_for: string | null;
}

/**
 * Koppelt posts zonder media-id (zelf geplaatst in de app) aan Instagram-media.
 * Regels: zelfde soort; tijdsverschil met posted_at of scheduled_for hoogstens `windowMs`;
 * elke media hoogstens één keer; de kleinste afstand wint. Media die al aan een post hangt
 * (`takenMediaIds`) doet niet mee.
 */
export function matchMedia(
  posts: MatchCandidate[],
  media: IgMedia[],
  takenMediaIds: Set<string>,
  windowMs = 3 * 3600 * 1000,
): Map<string, IgMedia> {
  const pairs: { postId: string; media: IgMedia; diff: number }[] = [];
  for (const p of posts) {
    const anchors = [p.posted_at, p.scheduled_for].filter(Boolean).map((s) => new Date(s!).getTime());
    if (!anchors.length) continue;
    for (const m of media) {
      if (takenMediaIds.has(m.id)) continue;
      if (mediaKind(m) !== p.media_type) continue;
      const ts = new Date(m.timestamp).getTime();
      const diff = Math.min(...anchors.map((a) => Math.abs(ts - a)));
      if (diff <= windowMs) pairs.push({ postId: p.id, media: m, diff });
    }
  }
  pairs.sort((a, b) => a.diff - b.diff);
  const out = new Map<string, IgMedia>();
  const usedMedia = new Set<string>();
  for (const pair of pairs) {
    if (out.has(pair.postId) || usedMedia.has(pair.media.id)) continue;
    out.set(pair.postId, pair.media);
    usedMedia.add(pair.media.id);
  }
  return out;
}

/**
 * Moet deze post opnieuw gemeten worden? Jonge posts vaak (de cijfers bewegen nog),
 * oudere zelden, na 35 dagen niet meer. Stories zijn na 24 u niet meer op te vragen.
 */
export function needsRefresh(
  mediaType: string,
  postedAt: string | null,
  fetchedAt: string | null | undefined,
  now = Date.now(),
  /** SOCIAL-6: is de 48-uursmeting er al? Zo niet en is de post 48 u oud, dan nu meten. */
  has48h = true,
): boolean {
  if (!postedAt) return false;
  const age = now - new Date(postedAt).getTime();
  const H = 3600 * 1000;
  if (age < 0) return false;
  if (!has48h && mediaType !== "story" && age >= 48 * H && age < 7 * 24 * H) return true;
  if (mediaType === "story" && age > 24 * H) return !fetchedAt; // nog één poging als het nooit lukte
  if (age > 35 * 24 * H) return false;
  if (!fetchedAt) return true;
  const since = now - new Date(fetchedAt).getTime();
  if (age < 2 * 24 * H) return since > 2.5 * H;
  if (age < 7 * 24 * H) return since > 12 * H;
  return since > 72 * H;
}

/** SOCIAL-6: is dit het moment voor de vaste 48-uursmeting (48 u tot 7 dagen na publicatie)? */
export function due48h(mediaType: string, postedAt: string | null, has48h: boolean, now = Date.now()): boolean {
  if (has48h || !postedAt || mediaType === "story") return false;
  const age = now - new Date(postedAt).getTime();
  return age >= 48 * 3600 * 1000 && age < 7 * 24 * 3600 * 1000;
}

/** Cijfers uit de medialijst als er (nog) geen toestemming voor statistieken is. */
export function basicMetrics(m: IgMedia): PostMetrics {
  const out: PostMetrics = {};
  if (typeof m.like_count === "number") out.likes = m.like_count;
  if (typeof m.comments_count === "number") out.comments = m.comments_count;
  return out;
}
