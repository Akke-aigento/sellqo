// SOCIAL-5 — unit tests voor de resultaten-module. Geen netwerk: fetch is nagebootst.
// Run: DENO_NO_PACKAGE_JSON=1 deno test --no-lock --node-modules-dir=none supabase/functions/_shared/socialInsights.test.ts
import {
  due48h, fetchMediaInsights, matchMedia, needsRefresh, parseInsights, type IgMedia,
} from "./socialInsights.ts";

function eq(actual: unknown, expected: unknown, msg = "") {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  verwacht: ${e}\n  gekregen: ${a}`);
}

function mockFetch(handler: (url: URL) => { status?: number; json: unknown }) {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push(url.searchParams.get("metric") ?? url.pathname);
    const r = handler(url);
    return Promise.resolve(new Response(JSON.stringify(r.json), { status: r.status ?? 200 }));
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

Deno.test("parseInsights: values en total_value, reel-kijktijd hernoemd", () => {
  const m = parseInsights({ data: [
    { name: "reach", values: [{ value: 120 }] },
    { name: "saved", total_value: { value: 7 } },
    { name: "ig_reels_avg_watch_time", values: [{ value: 4200 }] },
    { name: "onbekend", values: [{ value: 1 }] },
  ] });
  eq(m, { reach: 120, saved: 7, avg_watch_time_ms: 4200 });
});

Deno.test("fetchMediaInsights: geen toestemming → no_permission, geen tweede poging", async () => {
  const f = mockFetch(() => ({ status: 403, json: { error: { code: 10, message: "Application does not have permission for this action" } } }));
  try {
    const r = await fetchMediaInsights("tok", "m1", "image");
    eq(r.kind, "no_permission");
    eq(f.calls.length, 1);
  } finally { f.restore(); }
});

Deno.test("fetchMediaInsights: story onder 5 weergaven → low_volume", async () => {
  const f = mockFetch(() => ({ status: 400, json: { error: { code: 10, message: "(#10) Not enough viewers for the media to show insights" } } }));
  try {
    eq((await fetchMediaInsights("tok", "s1", "story")).kind, "low_volume");
  } finally { f.restore(); }
});

Deno.test("fetchMediaInsights: onbekende metric → kleinere set", async () => {
  const f = mockFetch((url) => url.searchParams.get("metric")!.includes("views")
    ? { status: 400, json: { error: { code: 100, message: "metric[1] must be one of ..." } } }
    : { json: { data: [{ name: "reach", values: [{ value: 50 }] }] } });
  try {
    const r = await fetchMediaInsights("tok", "m1", "reel");
    eq(r, { kind: "ok", metrics: { reach: 50 } });
    eq(f.calls.length, 2);
  } finally { f.restore(); }
});

const H = 3600 * 1000;
const T0 = Date.parse("2026-10-20T18:30:00Z");
const media: IgMedia[] = [
  { id: "a", timestamp: new Date(T0 + 10 * 60 * 1000).toISOString(), media_type: "IMAGE", media_product_type: "FEED" },
  { id: "b", timestamp: new Date(T0 + 30 * 60 * 1000).toISOString(), media_type: "VIDEO", media_product_type: "REELS" },
  { id: "c", timestamp: new Date(T0 + 5 * H).toISOString(), media_type: "IMAGE", media_product_type: "FEED" },
];

Deno.test("matchMedia: zelfde soort, dichtste tijd, buiten venster niet", () => {
  const out = matchMedia([
    { id: "p1", media_type: "image", posted_at: new Date(T0 + 40 * 60 * 1000).toISOString(), scheduled_for: new Date(T0).toISOString() },
    { id: "p2", media_type: "reel", posted_at: null, scheduled_for: new Date(T0).toISOString() },
    { id: "p3", media_type: "carousel", posted_at: new Date(T0).toISOString(), scheduled_for: null },
  ], media, new Set());
  eq([...out.entries()].map(([k, v]) => [k, v.id]), [["p1", "a"], ["p2", "b"]]);
});

Deno.test("matchMedia: media die al gekoppeld is doet niet mee; twee posts → één media", () => {
  const posts = [
    { id: "x", media_type: "image", posted_at: new Date(T0).toISOString(), scheduled_for: null },
    { id: "y", media_type: "image", posted_at: new Date(T0 + 15 * 60 * 1000).toISOString(), scheduled_for: null },
  ];
  eq([...matchMedia(posts, media, new Set(["a"])).keys()], []);
  eq([...matchMedia(posts, media, new Set()).entries()].map(([k, v]) => [k, v.id]), [["y", "a"]]);
});

Deno.test("needsRefresh: jong vaak, oud zelden, story na 24 u niet meer", () => {
  const now = T0 + 10 * H;
  const posted = new Date(T0).toISOString();
  eq(needsRefresh("image", posted, null, now), true);
  eq(needsRefresh("image", posted, new Date(now - 1 * H).toISOString(), now), false);
  eq(needsRefresh("image", posted, new Date(now - 3 * H).toISOString(), now), true);
  const old = new Date(T0 - 10 * 24 * H).toISOString();
  eq(needsRefresh("image", old, new Date(now - 24 * H).toISOString(), now), false);
  eq(needsRefresh("story", old, new Date(now - 100 * H).toISOString(), now), false);
  eq(needsRefresh("image", new Date(T0 - 40 * 24 * H).toISOString(), null, now), false);
});

Deno.test("48-uursmeting: vanaf 48 u tot 7 dagen, één keer, niet voor stories", () => {
  const posted = new Date(T0).toISOString();
  eq(due48h("image", posted, false, T0 + 47 * H), false);
  eq(due48h("image", posted, false, T0 + 50 * H), true);
  eq(due48h("image", posted, true, T0 + 50 * H), false);
  eq(due48h("story", posted, false, T0 + 50 * H), false);
  eq(due48h("image", posted, false, T0 + 8 * 24 * H), false);
  // needsRefresh dwingt de meting af, ook als de vorige meting recent was
  eq(needsRefresh("image", posted, new Date(T0 + 49 * H).toISOString(), T0 + 50 * H, false), true);
  eq(needsRefresh("image", posted, new Date(T0 + 49 * H).toISOString(), T0 + 50 * H, true), false);
});
