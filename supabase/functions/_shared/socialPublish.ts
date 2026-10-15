// SOCIAL-1 — één plek die weet hoe je een post echt op een platform krijgt.
//
// Gebruikt door `social-post-publish` (meteen posten vanuit de app) en
// `social-publish-due` (de scheduler). Vóór SOCIAL-1 zat dit in
// social-post-publish zelf, met drie fouten:
//   1. `instagram` liep via de Facebook-code (`/{page}/photos`), dus er verscheen
//      niets op Instagram — enkel op de Facebook-pagina.
//   2. Graph API v18 (verlopen).
//   3. Altijd "de eerste pagina" uit /me/accounts: wie meerdere pagina's beheert,
//      postte op een willekeurige pagina.
//
// Instagram kan langs twee wegen:
//   - Instagram Login (`api_kind = 'instagram_login'`): token van het IG-account zelf,
//     host graph.instagram.com. Geen Facebook-pagina nodig.
//   - Facebook Login: het IG-account hangt aan een Facebook-pagina; publiceren met
//     het page-token op graph.facebook.com. De koppeling staat in
//     meta_messaging_connections (platform 'instagram', instagram_account_id).
//
// Beelden moeten op een publieke URL staan: het platform haalt ze zelf op.
// Instagram aanvaardt enkel JPEG.

// Losse structuur i.p.v. SupabaseClient: zelfde reden als in cronAuth.ts.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SocialDbClient = { from: (table: string) => any };

function envOr(name: string, fallback: string): string {
  try {
    return Deno.env.get(name) || fallback;
  } catch {
    // Unit tests draaien zonder --allow-env.
    return fallback;
  }
}

/** Meta Graph API-versie. Overschrijfbaar met de secret META_GRAPH_VERSION bij een volgende bump. */
export const GRAPH_VERSION = envOr("META_GRAPH_VERSION", "v25.0");
const FB_HOST = "https://graph.facebook.com";
const IG_HOST = "https://graph.instagram.com";

export type SocialPlatform = "facebook" | "instagram" | "twitter" | "linkedin";
export type SocialMediaType = "image" | "carousel" | "story";

export interface PublishInput {
  text: string;
  imageUrls: string[];
  mediaType: SocialMediaType;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  postedAt?: string;
  error?: string;
  /** true = tijdelijk probleem (netwerk, rate limit, 5xx): later opnieuw proberen heeft zin. */
  retryable?: boolean;
}

export type PublishTarget =
  | { kind: "instagram"; connectionId: string; host: string; igUserId: string; token: string }
  | { kind: "facebook"; connectionId: string; pageId: string; token: string }
  | { kind: "twitter"; connectionId: string; token: string }
  | { kind: "linkedin"; connectionId: string; token: string; authorId: string };

export type ResolveResult = { ok: true; target: PublishTarget } | { ok: false; error: string };

interface ConnectionRow {
  id: string;
  platform: string;
  access_token: string | null;
  token_expires_at: string | null;
  account_id: string | null;
  is_active: boolean;
  api_kind: string | null;
  target_page_id: string | null;
}

interface MetaPageRow {
  page_id: string;
  page_name: string | null;
  page_access_token: string | null;
  instagram_account_id: string | null;
  platform: string;
}

function isExpired(expiresAt: string | null): boolean {
  return !!expiresAt && new Date(expiresAt) <= new Date();
}

async function loadConnection(
  db: SocialDbClient,
  tenantId: string,
  platform: string,
): Promise<ConnectionRow | null> {
  const { data } = await db
    .from("social_connections")
    .select("id, platform, access_token, token_expires_at, account_id, is_active, api_kind, target_page_id")
    .eq("tenant_id", tenantId)
    .eq("platform", platform)
    .eq("is_active", true)
    .maybeSingle();
  return (data as ConnectionRow | null) ?? null;
}

/**
 * Kiest de Facebook-pagina waarop deze tenant post. Nooit gokken: bij meerdere
 * pagina's zonder keuze is het een fout met uitleg, geen "eerste pagina".
 */
async function pickPage(
  db: SocialDbClient,
  tenantId: string,
  targetPageId: string | null,
): Promise<{ ok: true; page: MetaPageRow } | { ok: false; error: string }> {
  const { data } = await db
    .from("meta_messaging_connections")
    .select("page_id, page_name, page_access_token, instagram_account_id, platform")
    .eq("tenant_id", tenantId)
    .eq("platform", "facebook")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  const pages = (data as MetaPageRow[] | null) ?? [];

  if (targetPageId) {
    const page = pages.find((p) => p.page_id === targetPageId);
    if (!page) {
      return { ok: false, error: "De gekozen Facebook-pagina is niet meer gekoppeld. Koppel Meta opnieuw in SellQo Connect → Kanalen." };
    }
    return { ok: true, page };
  }
  if (pages.length === 1) return { ok: true, page: pages[0] };
  if (pages.length === 0) {
    return { ok: false, error: "Geen Facebook-pagina gevonden. Koppel Meta opnieuw met een account dat een pagina beheert." };
  }
  return { ok: false, error: "Je beheert meerdere Facebook-pagina's en SellQo weet niet op welke je wil posten. Koppel Instagram rechtstreeks in SellQo Connect → Kanalen; een paginakeuze voor Facebook volgt." };
}

/** Bepaalt met welk account en token een post voor dit platform vertrekt. */
export async function resolveTarget(
  db: SocialDbClient,
  tenantId: string,
  platform: SocialPlatform,
): Promise<ResolveResult> {
  if (platform === "instagram") {
    // 1. Instagram Login: rechtstreeks het IG-account.
    const ig = await loadConnection(db, tenantId, "instagram");
    if (ig && ig.api_kind === "instagram_login" && ig.access_token && ig.account_id) {
      if (isExpired(ig.token_expires_at)) {
        return { ok: false, error: "De Instagram-koppeling is verlopen. Koppel Instagram opnieuw in SellQo Connect → Kanalen." };
      }
      return {
        ok: true,
        target: { kind: "instagram", connectionId: ig.id, host: IG_HOST, igUserId: ig.account_id, token: ig.access_token },
      };
    }

    // 2. Facebook Login: het IG-account dat aan de gekozen pagina hangt.
    const fb = await loadConnection(db, tenantId, "facebook");
    if (!fb) {
      return { ok: false, error: "Geen Instagram-koppeling. Koppel Instagram in SellQo Connect → Kanalen." };
    }
    const picked = await pickPage(db, tenantId, fb.target_page_id);
    if (!picked.ok) return picked;

    const { data: igRow } = await db
      .from("meta_messaging_connections")
      .select("page_id, page_name, page_access_token, instagram_account_id, platform")
      .eq("tenant_id", tenantId)
      .eq("platform", "instagram")
      .eq("page_id", picked.page.page_id)
      .eq("is_active", true)
      .maybeSingle();
    const row = igRow as MetaPageRow | null;
    if (!row?.instagram_account_id || !row.page_access_token) {
      return {
        ok: false,
        error: `Aan de Facebook-pagina "${picked.page.page_name ?? picked.page.page_id}" hangt geen professioneel Instagram-account. Koppel Instagram rechtstreeks of verbind het account met die pagina.`,
      };
    }
    return {
      ok: true,
      target: {
        kind: "instagram",
        connectionId: fb.id,
        host: FB_HOST,
        igUserId: row.instagram_account_id,
        token: row.page_access_token,
      },
    };
  }

  if (platform === "facebook") {
    const fb = await loadConnection(db, tenantId, "facebook");
    if (!fb) return { ok: false, error: "Geen actieve Facebook-koppeling gevonden." };
    const picked = await pickPage(db, tenantId, fb.target_page_id);
    if (!picked.ok) return picked;
    if (!picked.page.page_access_token) {
      return { ok: false, error: "De Facebook-pagina heeft geen geldig token. Koppel Meta opnieuw." };
    }
    return {
      ok: true,
      target: { kind: "facebook", connectionId: fb.id, pageId: picked.page.page_id, token: picked.page.page_access_token },
    };
  }

  const conn = await loadConnection(db, tenantId, platform);
  if (!conn || !conn.access_token) return { ok: false, error: `Geen actieve ${platform}-koppeling gevonden.` };
  if (isExpired(conn.token_expires_at)) {
    return { ok: false, error: "Token verlopen. Koppel je account opnieuw." };
  }
  if (platform === "twitter") {
    return { ok: true, target: { kind: "twitter", connectionId: conn.id, token: conn.access_token } };
  }
  return {
    ok: true,
    target: { kind: "linkedin", connectionId: conn.id, token: conn.access_token, authorId: conn.account_id ?? "" },
  };
}

// --- Meta-hulpfuncties ----------------------------------------------------------------

interface GraphError {
  message?: string;
  code?: number;
  is_transient?: boolean;
  error_user_msg?: string;
}

/** Meta-foutcodes die op een tijdelijk probleem wijzen (rate limits, tijdelijke storing). */
const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);

class GraphCallError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

async function graph(
  host: string,
  path: string,
  token: string,
  method: "GET" | "POST",
  params: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const url = new URL(`${host}/${GRAPH_VERSION}/${path}`);
  let response: Response;
  try {
    if (method === "GET") {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      url.searchParams.set("access_token", token);
      response = await fetch(url);
    } else {
      // Token in de body, niet in de URL: URL's belanden in logs.
      const body = new URLSearchParams({ ...params, access_token: token });
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
    }
  } catch (err) {
    throw new GraphCallError(`Netwerkfout naar Meta: ${(err as Error).message}`, true);
  }

  let json: Record<string, unknown> = {};
  try {
    json = await response.json();
  } catch {
    // leeg of geen JSON
  }
  const err = json.error as GraphError | undefined;
  if (!response.ok || err) {
    const msg = err?.error_user_msg || err?.message || `HTTP ${response.status}`;
    const retryable = response.status >= 500 || !!err?.is_transient || (err?.code !== undefined && TRANSIENT_CODES.has(err.code));
    throw new GraphCallError(msg, retryable);
  }
  return json;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function looksLikeNonJpeg(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(png|webp|gif|avif|heic|svg)$/.test(path);
  } catch {
    return false;
  }
}

/** Wacht tot een IG-container FINISHED is. Beelden zijn meestal meteen klaar. */
async function waitForContainer(host: string, containerId: string, token: string): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const status = await graph(host, containerId, token, "GET", { fields: "status_code" });
    const code = String(status.status_code ?? "");
    if (code === "FINISHED" || code === "PUBLISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new GraphCallError(`Instagram kon het beeld niet verwerken (status ${code}). Is het een publiek bereikbare JPEG?`, false);
    }
    await sleep(3000);
  }
  throw new GraphCallError("Instagram was na 24 seconden nog bezig met het beeld.", true);
}

async function publishInstagram(
  target: Extract<PublishTarget, { kind: "instagram" }>,
  input: PublishInput,
): Promise<PublishResult> {
  const { host, igUserId, token } = target;
  const images = input.imageUrls.filter(Boolean);

  if (images.length === 0) {
    return { success: false, error: "Instagram vereist minstens één beeld.", retryable: false };
  }
  const bad = images.find(looksLikeNonJpeg);
  if (bad) {
    return { success: false, error: `Instagram aanvaardt enkel JPEG-beelden (${bad}).`, retryable: false };
  }

  let creationId: string;
  if (input.mediaType === "story") {
    if (images.length !== 1) {
      return { success: false, error: "Een story bevat precies één beeld.", retryable: false };
    }
    const c = await graph(host, `${igUserId}/media`, token, "POST", { media_type: "STORIES", image_url: images[0] });
    creationId = String(c.id);
  } else if (input.mediaType === "carousel" || images.length > 1) {
    if (images.length < 2 || images.length > 10) {
      return { success: false, error: "Een carrousel bevat 2 tot 10 beelden.", retryable: false };
    }
    const children: string[] = [];
    for (const image of images) {
      const child = await graph(host, `${igUserId}/media`, token, "POST", { image_url: image, is_carousel_item: "true" });
      children.push(String(child.id));
    }
    for (const child of children) await waitForContainer(host, child, token);
    const c = await graph(host, `${igUserId}/media`, token, "POST", {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption: input.text,
    });
    creationId = String(c.id);
  } else {
    const c = await graph(host, `${igUserId}/media`, token, "POST", { image_url: images[0], caption: input.text });
    creationId = String(c.id);
  }

  await waitForContainer(host, creationId, token);
  const published = await graph(host, `${igUserId}/media_publish`, token, "POST", { creation_id: creationId });
  return { success: true, platformPostId: String(published.id), postedAt: new Date().toISOString() };
}

async function publishFacebook(
  target: Extract<PublishTarget, { kind: "facebook" }>,
  input: PublishInput,
): Promise<PublishResult> {
  const { pageId, token } = target;
  const images = input.imageUrls.filter(Boolean);

  if (input.mediaType === "story") {
    return { success: false, error: "Facebook-stories kunnen niet via SellQo gepubliceerd worden.", retryable: false };
  }

  if (images.length === 0) {
    const r = await graph(FB_HOST, `${pageId}/feed`, token, "POST", { message: input.text });
    return { success: true, platformPostId: String(r.id), postedAt: new Date().toISOString() };
  }
  if (images.length === 1) {
    const r = await graph(FB_HOST, `${pageId}/photos`, token, "POST", { url: images[0], caption: input.text });
    return { success: true, platformPostId: String(r.post_id ?? r.id), postedAt: new Date().toISOString() };
  }

  // Meerdere beelden: eerst ongepubliceerd uploaden, dan één bericht met alle foto's.
  const params: Record<string, string> = { message: input.text };
  let i = 0;
  for (const image of images.slice(0, 10)) {
    const photo = await graph(FB_HOST, `${pageId}/photos`, token, "POST", { url: image, published: "false" });
    params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: String(photo.id) });
    i++;
  }
  const r = await graph(FB_HOST, `${pageId}/feed`, token, "POST", params);
  return { success: true, platformPostId: String(r.id), postedAt: new Date().toISOString() };
}

// --- X en LinkedIn: ongewijzigd overgenomen uit social-post-publish -------------------
// Bewust niet aangepast in SOCIAL-1 (LinkedIn-bedrijfspagina's volgen in een latere reeks).

async function publishTwitter(token: string, text: string): Promise<PublishResult> {
  try {
    const response = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const result = await response.json();
    if (result.data?.id) {
      return { success: true, platformPostId: result.data.id, postedAt: new Date().toISOString() };
    }
    return { success: false, error: result.detail || result.title || "Onbekende Twitter fout", retryable: response.status >= 500 };
  } catch (err) {
    return { success: false, error: (err as Error).message, retryable: true };
  }
}

async function publishLinkedIn(token: string, authorId: string, text: string): Promise<PublishResult> {
  try {
    const body = {
      author: `urn:li:person:${authorId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": { shareCommentary: { text }, shareMediaCategory: "NONE" },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };
    const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (result.id) {
      return { success: true, platformPostId: result.id, postedAt: new Date().toISOString() };
    }
    return { success: false, error: result.message || "Onbekende LinkedIn fout", retryable: response.status >= 500 };
  } catch (err) {
    return { success: false, error: (err as Error).message, retryable: true };
  }
}

/** Publiceert één post. Gooit nooit: elke fout komt terug als PublishResult. */
export async function publishPost(target: PublishTarget, input: PublishInput): Promise<PublishResult> {
  try {
    switch (target.kind) {
      case "instagram":
        return await publishInstagram(target, input);
      case "facebook":
        return await publishFacebook(target, input);
      case "twitter":
        return await publishTwitter(target.token, input.text);
      case "linkedin":
        return await publishLinkedIn(target.token, target.authorId, input.text);
    }
  } catch (err) {
    if (err instanceof GraphCallError) {
      return { success: false, error: err.message, retryable: err.retryable };
    }
    return { success: false, error: (err as Error).message || "Onbekende fout", retryable: true };
  }
}

/**
 * Ververst een long-lived token van Instagram Login (60 dagen geldig).
 * Voorwaarden van Meta: het token is minstens 24 uur oud en nog niet verlopen.
 */
export async function refreshInstagramToken(
  token: string,
): Promise<{ ok: true; token: string; expiresAt: string | null } | { ok: false; error: string }> {
  const url = new URL(`${IG_HOST}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);
  try {
    const response = await fetch(url);
    const json = await response.json();
    if (!response.ok || !json.access_token) {
      return { ok: false, error: json.error?.message || `HTTP ${response.status}` };
    }
    const expiresAt = json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString() : null;
    return { ok: true, token: String(json.access_token), expiresAt };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
