// SOCIAL-1 — unit tests voor de social-publicatie (geen netwerk: fetch is nagebootst).
// Run: DENO_NO_PACKAGE_JSON=1 deno test --no-lock --node-modules-dir=none supabase/functions/_shared/socialPublish.test.ts
import { publishPost, resolveTarget, type PublishTarget, type SocialDbClient } from "./socialPublish.ts";

function eq(actual: unknown, expected: unknown, msg = "") {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  verwacht: ${e}\n  gekregen: ${a}`);
}
function ok(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// --- Nep-databank: filtert rijen op eq(), geeft {data} terug zoals supabase-js ----------
type Row = Record<string, unknown>;
function fakeDb(tables: Record<string, Row[]>): SocialDbClient {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      const run = () => (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
      const builder = {
        select: () => builder,
        eq: (k: string, v: unknown) => { filters.push([k, v]); return builder; },
        order: () => builder,
        maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
        then: (res: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: run(), error: null }).then(res),
      };
      return builder;
    },
  };
}

// --- Nep-fetch: registreert elke call en antwoordt volgens een handler ---------------
interface Call { url: string; method: string; body: URLSearchParams }
function mockFetch(handler: (c: Call) => { status?: number; json: unknown }) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const call: Call = { url, method: init?.method ?? "GET", body: new URLSearchParams(String(init?.body ?? "")) };
    calls.push(call);
    const r = handler(call);
    return Promise.resolve(new Response(JSON.stringify(r.json), { status: r.status ?? 200 }));
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const T = "tenant-1";

Deno.test("resolveTarget: Instagram Login gaat rechtstreeks naar graph.instagram.com", async () => {
  const db = fakeDb({
    social_connections: [{ id: "c-ig", tenant_id: T, platform: "instagram", is_active: true, api_kind: "instagram_login", access_token: "ig-tok", account_id: "17841", token_expires_at: null }],
  });
  const r = await resolveTarget(db, T, "instagram");
  ok(r.ok, "moet lukken");
  if (r.ok) eq(r.target, { kind: "instagram", connectionId: "c-ig", host: "https://graph.instagram.com", igUserId: "17841", token: "ig-tok" });
});

Deno.test("resolveTarget: Instagram via Facebook-pagina gebruikt het page-token en het gekoppelde IG-account", async () => {
  const db = fakeDb({
    social_connections: [{ id: "c-fb", tenant_id: T, platform: "facebook", is_active: true, api_kind: null, access_token: "user", target_page_id: null }],
    meta_messaging_connections: [
      { tenant_id: T, platform: "facebook", is_active: true, page_id: "p1", page_name: "Loveke", page_access_token: "page-tok" },
      { tenant_id: T, platform: "instagram", is_active: true, page_id: "p1", page_name: "loveke", page_access_token: "page-tok", instagram_account_id: "ig-1" },
    ],
  });
  const r = await resolveTarget(db, T, "instagram");
  ok(r.ok, "moet lukken");
  if (r.ok) eq(r.target, { kind: "instagram", connectionId: "c-fb", host: "https://graph.facebook.com", igUserId: "ig-1", token: "page-tok" });
});

Deno.test("resolveTarget: meerdere pagina's zonder keuze is een fout, geen gok", async () => {
  const db = fakeDb({
    social_connections: [{ id: "c-fb", tenant_id: T, platform: "facebook", is_active: true, access_token: "user", target_page_id: null }],
    meta_messaging_connections: [
      { tenant_id: T, platform: "facebook", is_active: true, page_id: "p1", page_access_token: "a" },
      { tenant_id: T, platform: "facebook", is_active: true, page_id: "p2", page_access_token: "b" },
    ],
  });
  const r = await resolveTarget(db, T, "facebook");
  ok(!r.ok && r.error.includes("meerdere"), "moet om een keuze vragen");
});

Deno.test("resolveTarget: gekozen pagina wint", async () => {
  const db = fakeDb({
    social_connections: [{ id: "c-fb", tenant_id: T, platform: "facebook", is_active: true, access_token: "user", target_page_id: "p2" }],
    meta_messaging_connections: [
      { tenant_id: T, platform: "facebook", is_active: true, page_id: "p1", page_access_token: "a" },
      { tenant_id: T, platform: "facebook", is_active: true, page_id: "p2", page_access_token: "b" },
    ],
  });
  const r = await resolveTarget(db, T, "facebook");
  ok(r.ok, "moet lukken");
  if (r.ok) eq(r.target, { kind: "facebook", connectionId: "c-fb", pageId: "p2", token: "b" });
});

Deno.test("resolveTarget: verlopen Instagram-token geeft een duidelijke fout", async () => {
  const db = fakeDb({
    social_connections: [{ id: "c-ig", tenant_id: T, platform: "instagram", is_active: true, api_kind: "instagram_login", access_token: "x", account_id: "1", token_expires_at: "2020-01-01T00:00:00Z" }],
  });
  const r = await resolveTarget(db, T, "instagram");
  ok(!r.ok && r.error.includes("verlopen"), "moet verlopen melden");
});

const IG: PublishTarget = { kind: "instagram", connectionId: "c", host: "https://graph.instagram.com", igUserId: "17841", token: "tok" };

Deno.test("Instagram: enkel beeld = container → status → media_publish, token niet in de URL", async () => {
  const m = mockFetch((c) => {
    if (c.url.includes("/media_publish")) return { json: { id: "media-99" } };
    if (c.url.includes("/media")) return { json: { id: "cont-1" } };
    return { json: { status_code: "FINISHED" } };
  });
  try {
    const r = await publishPost(IG, { text: "Hallo", imageUrls: ["https://x.test/a.jpg"], mediaType: "image" });
    eq(r.success, true); eq(r.platformPostId, "media-99");
    eq(m.calls.map((c) => `${c.method} ${new URL(c.url).pathname}`), [
      "POST /v25.0/17841/media", "GET /v25.0/cont-1", "POST /v25.0/17841/media_publish",
    ]);
    eq(m.calls[0].body.get("caption"), "Hallo");
    eq(m.calls[0].body.get("image_url"), "https://x.test/a.jpg");
    ok(!m.calls[0].url.includes("tok"), "token mag niet in een POST-URL staan");
  } finally { m.restore(); }
});

Deno.test("Instagram: carrousel maakt eerst items, dan de carrouselcontainer", async () => {
  let n = 0;
  const m = mockFetch((c) => {
    if (c.url.includes("/media_publish")) return { json: { id: "media-1" } };
    if (c.url.includes("/media")) return { json: { id: `cont-${++n}` } };
    return { json: { status_code: "FINISHED" } };
  });
  try {
    const r = await publishPost(IG, { text: "Drie", imageUrls: ["https://x.test/1.jpg", "https://x.test/2.jpg", "https://x.test/3.jpg"], mediaType: "carousel" });
    eq(r.success, true);
    const posts = m.calls.filter((c) => c.method === "POST");
    eq(posts.slice(0, 3).map((c) => c.body.get("is_carousel_item")), ["true", "true", "true"]);
    eq(posts[3].body.get("media_type"), "CAROUSEL");
    eq(posts[3].body.get("children"), "cont-1,cont-2,cont-3");
    eq(posts[4].body.get("creation_id"), "cont-4");
  } finally { m.restore(); }
});

Deno.test("Instagram: story zonder caption, PNG en tekst-zonder-beeld worden geweigerd zonder call", async () => {
  const m = mockFetch((c) => (c.url.includes("/media_publish") ? { json: { id: "s1" } } : c.url.includes("/media") ? { json: { id: "c1" } } : { json: { status_code: "FINISHED" } }));
  try {
    const story = await publishPost(IG, { text: "negeren", imageUrls: ["https://x.test/s.jpg"], mediaType: "story" });
    eq(story.success, true);
    eq(m.calls[0].body.get("media_type"), "STORIES");
    eq(m.calls[0].body.get("caption"), null);
    const before = m.calls.length;
    const png = await publishPost(IG, { text: "x", imageUrls: ["https://x.test/a.png"], mediaType: "image" });
    eq([png.success, png.retryable], [false, false]);
    const none = await publishPost(IG, { text: "x", imageUrls: [], mediaType: "image" });
    eq([none.success, none.retryable], [false, false]);
    eq(m.calls.length, before, "geen API-call voor ongeldige input");
  } finally { m.restore(); }
});

Deno.test("Meta-fouten: rate limit is tijdelijk, ongeldig token niet", async () => {
  let m = mockFetch(() => ({ status: 400, json: { error: { message: "Too many calls", code: 4 } } }));
  try {
    const r = await publishPost(IG, { text: "x", imageUrls: ["https://x.test/a.jpg"], mediaType: "image" });
    eq([r.success, r.retryable], [false, true]);
  } finally { m.restore(); }
  m = mockFetch(() => ({ status: 400, json: { error: { message: "Invalid OAuth access token", code: 190 } } }));
  try {
    const r = await publishPost(IG, { text: "x", imageUrls: ["https://x.test/a.jpg"], mediaType: "image" });
    eq([r.success, r.retryable, r.error], [false, false, "Invalid OAuth access token"]);
  } finally { m.restore(); }
});

Deno.test("Facebook: meerdere beelden = ongepubliceerde foto's + één feed-bericht", async () => {
  let n = 0;
  const m = mockFetch((c) => (c.url.endsWith("/photos") ? { json: { id: `ph-${++n}` } } : { json: { id: "post-1" } }));
  try {
    const FB: PublishTarget = { kind: "facebook", connectionId: "c", pageId: "p1", token: "pt" };
    const r = await publishPost(FB, { text: "Twee", imageUrls: ["https://x.test/1.jpg", "https://x.test/2.jpg"], mediaType: "image" });
    eq(r.success, true); eq(r.platformPostId, "post-1");
    eq(m.calls.map((c) => new URL(c.url).pathname), ["/v25.0/p1/photos", "/v25.0/p1/photos", "/v25.0/p1/feed"]);
    eq(m.calls[0].body.get("published"), "false");
    eq(m.calls[2].body.get("attached_media[1]"), JSON.stringify({ media_fbid: "ph-2" }));
    eq(m.calls[2].body.get("message"), "Twee");
  } finally { m.restore(); }
});
