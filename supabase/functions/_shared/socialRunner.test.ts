// SOCIAL-4c — unit tests voor runClaimedPost (gedeeld door de cron en "Nu posten").
// Geen netwerk: fetch is nagebootst, de databank is een kleine nep.
// Run: DENO_NO_PACKAGE_JSON=1 deno test --no-lock --node-modules-dir=none supabase/functions/_shared/socialRunner.test.ts
import { runClaimedPost, type ClaimedPost } from "./socialRunner.ts";
import { reelPolling } from "./socialPublish.ts";

function eq(actual: unknown, expected: unknown, msg = "") {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  verwacht: ${e}\n  gekregen: ${a}`);
}

type Row = Record<string, unknown>;
function fakeAdmin(tables: Record<string, Row[]>) {
  const updates: { table: string; values: Row; id: unknown }[] = [];
  const inserts: { table: string; values: Row }[] = [];
  const admin = {
    from(table: string) {
      const filters: [string, unknown][] = [];
      let pendingUpdate: Row | null = null;
      const run = () => (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
      const builder = {
        select: () => builder,
        order: () => builder,
        eq: (k: string, v: unknown) => {
          filters.push([k, v]);
          if (pendingUpdate) updates.push({ table, values: pendingUpdate, id: v });
          return builder;
        },
        update: (values: Row) => { pendingUpdate = values; return builder; },
        insert: (values: Row) => { inserts.push({ table, values }); return Promise.resolve({ error: null }); },
        maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
        then: (res: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: run(), error: null }).then(res),
      };
      return builder;
    },
  };
  return { admin, updates, inserts };
}

function mockFetch(handler: (url: string, method: string) => { status?: number; json: unknown }) {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const r = handler(url, init?.method ?? "GET");
    return Promise.resolve(new Response(JSON.stringify(r.json), { status: r.status ?? 200 }));
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

const T = "t1";
const tables = {
  social_connections: [{ id: "c1", tenant_id: T, platform: "instagram", is_active: true, api_kind: "instagram_login", access_token: "tok", account_id: "178", token_expires_at: null }],
};
const own = "own.test";
const base: ClaimedPost = {
  id: "p1", tenant_id: T, platform: "instagram", post_text: "hallo",
  image_urls: ["https://own.test/a.jpg"], media_type: "image", publish_attempts: 1,
  publish_claimed_from: "approved", video_url: null, publish_container_id: null,
};

Deno.test("runner: gelukt → posted met platform-id", async () => {
  const { admin, updates } = fakeAdmin(tables);
  const restore = mockFetch((url, method) => {
    if (method === "POST" && url.endsWith("/178/media")) return { json: { id: "ctr" } };
    if (url.includes("/ctr")) return { json: { status_code: "FINISHED" } };
    if (url.endsWith("/media_publish")) return { json: { id: "ig-1" } };
    return { status: 400, json: { error: { message: "?" } } };
  });
  try {
    const out = await runClaimedPost(admin, base, { ownHost: own });
    eq(out, { status: "posted", platformPostId: "ig-1" });
    eq(updates.at(-1)?.values.status, "posted");
  } finally { restore(); }
});

Deno.test("runner: tijdelijke fout → terug naar vorige status, geen melding", async () => {
  const { admin, updates, inserts } = fakeAdmin(tables);
  const restore = mockFetch(() => ({ status: 503, json: { error: { message: "even niet" } } }));
  try {
    const out = await runClaimedPost(admin, base, { ownHost: own });
    eq(out.status, "retry");
    eq(updates.at(-1)?.values.status, "approved");
    eq(inserts.length, 0);
  } finally { restore(); }
});

Deno.test("runner: leesmodus → failed met melding, zonder Meta-call", async () => {
  const { admin, updates, inserts } = fakeAdmin(tables);
  let calls = 0;
  const restore = mockFetch(() => { calls++; return { json: {} }; });
  try {
    const out = await runClaimedPost(admin, base, { ownHost: own, billingBlocked: true });
    eq(out.status, "failed");
    eq([updates.at(-1)?.values.status, inserts[0]?.table, calls], ["failed", "notifications", 0]);
  } finally { restore(); }
});

Deno.test("runner: reel nog in verwerking → processing, container bewaard, poging telt niet", async () => {
  reelPolling.intervalMs = 1; reelPolling.attempts = 2;
  const { admin, updates } = fakeAdmin(tables);
  const restore = mockFetch((url, method) => {
    if (method === "POST" && url.endsWith("/178/media")) return { json: { id: "ctr-r" } };
    return { json: { status_code: "IN_PROGRESS" } };
  });
  try {
    const reel = { ...base, media_type: "reel", video_url: "https://own.test/v.mp4", image_urls: [] };
    const out = await runClaimedPost(admin, reel, { ownHost: own });
    eq(out, { status: "processing" });
    const last = updates.at(-1)?.values ?? {};
    eq([last.status, last.publish_container_id, last.publish_attempts], ["approved", "ctr-r", 0]);
  } finally { restore(); reelPolling.attempts = 9; }
});
