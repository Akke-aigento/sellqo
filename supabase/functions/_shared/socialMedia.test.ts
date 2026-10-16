// SOCIAL-1c — unit tests voor het klaarmaken van Instagram-beelden (geen netwerk: fetch is nagebootst).
// Run: DENO_NO_PACKAGE_JSON=1 deno test --no-lock --node-modules-dir=none supabase/functions/_shared/socialMedia.test.ts
// @ts-ignore: esm.sh-module zonder typeaanduiding
import { encode as encodePng } from "https://esm.sh/fast-png@6.3.0";
// @ts-ignore: esm.sh-module zonder typeaanduiding
import jpeg from "https://esm.sh/jpeg-js@0.4.4";
import { prepareInstagramImages, sniffImage, toInstagramJpeg, type SocialStorageClient } from "./socialMedia.ts";

function eq(actual: unknown, expected: unknown, msg = "") {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  verwacht: ${e}\n  gekregen: ${a}`);
}
function ok(cond: unknown, msg: string) { if (!cond) throw new Error(msg); }

const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** PNG met transparante achtergrond en een rood vierkant in het midden. */
function transparentPng(w: number, h: number): Uint8Array {
  const data = new Uint8Array(w * h * 4); // volledig transparant
  for (let y = Math.floor(h / 4); y < Math.floor(h * 3 / 4); y++) {
    for (let x = Math.floor(w / 4); x < Math.floor(w * 3 / 4); x++) {
      const i = (y * w + x) * 4;
      data[i] = 255; data[i + 3] = 255;
    }
  }
  return encodePng({ width: w, height: h, data, channels: 4, depth: 8 });
}

/** PNG met palet (komt vaak voor bij geoptimaliseerde productfoto's): 2x2, blauw. */
function palettePng(): Uint8Array {
  // Handgemaakt (kleurtype 3, PLTE met één kleur): fast-png kan geen palet schrijven.
  return Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAMAAABFaP0WAAAAA1BMVEUAAP+KeNJXAAAAC0lEQVR4nGNgAAEAAAYAAf6MZ8gAAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
}

function decodeJpeg(bytes: Uint8Array) {
  return jpeg.decode(bytes, { useTArray: true });
}
function pixel(img: { width: number; data: Uint8Array }, x: number, y: number) {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

Deno.test("toInstagramJpeg: transparantie wordt wit, resultaat is JPEG", () => {
  const jpg = toInstagramJpeg(transparentPng(400, 400));
  ok(isJpeg(jpg), "moet JPEG zijn");
  eq(sniffImage(jpg), "jpeg");
  const out = decodeJpeg(jpg);
  eq([out.width, out.height], [400, 400]);
  const [r, g, b] = pixel(out, 5, 5);
  ok(r > 245 && g > 245 && b > 245, `hoek moet wit zijn, was ${r},${g},${b}`);
  const [cr, cg] = pixel(out, 200, 200);
  ok(cr > 200 && cg < 60, "midden moet rood blijven");
});

Deno.test("toInstagramJpeg: palet-PNG wordt correct omgezet", () => {
  const out = decodeJpeg(toInstagramJpeg(palettePng()));
  const [r, g, b] = pixel(out, 0, 0);
  ok(b > 200 && r < 60 && g < 60, `moet blauw zijn, was ${r},${g},${b}`);
});

Deno.test("toInstagramJpeg: te hoog beeld krijgt witte zijranden tot 4:5", () => {
  const out = decodeJpeg(toInstagramJpeg(transparentPng(400, 1000)));
  eq([out.width, out.height], [800, 1000]);
});

Deno.test("toInstagramJpeg: te breed beeld krijgt witte randen tot 1,91:1", () => {
  const out = decodeJpeg(toInstagramJpeg(transparentPng(1000, 300)));
  eq([out.width, out.height], [1000, Math.ceil(1000 / 1.91)]);
});

Deno.test("toInstagramJpeg: breder dan 1440 px wordt verkleind", () => {
  const out = decodeJpeg(toInstagramJpeg(transparentPng(2000, 2000)));
  eq([out.width, out.height], [1440, 1440]);
  const [cr] = pixel(out, 720, 720);
  ok(cr > 200, "inhoud blijft behouden na verkleinen");
});

// --- prepareInstagramImages ------------------------------------------------------------

function fakeStorage() {
  const uploads: { path: string; size: number; type: string }[] = [];
  const client: SocialStorageClient = {
    storage: {
      from: (_bucket: string) => ({
        upload: (path, body, options) => {
          uploads.push({ path, size: body.length, type: options.contentType });
          return Promise.resolve({ error: null });
        },
        getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn.test/marketing-assets/${path}` } }),
      }),
    },
  };
  return { client, uploads };
}

function mockFetch(handler: (url: string, method: string) => Response) {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url}`);
    return Promise.resolve(handler(url, method));
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

Deno.test("prepare: JPEG-URL's gaan ongewijzigd door, zonder één call", async () => {
  const { client, uploads } = fakeStorage();
  const m = mockFetch(() => new Response("nee", { status: 500 }));
  try {
    const r = await prepareInstagramImages(client, "t1", ["https://x.test/a.jpg", "https://x.test/b.JPEG"]);
    eq(r, { ok: true, urls: ["https://x.test/a.jpg", "https://x.test/b.JPEG"], converted: 0 });
    eq(m.calls.length, 0); eq(uploads.length, 0);
  } finally { m.restore(); }
});

Deno.test("prepare: PNG wordt omgezet, opgeslagen als JPEG en die URL gebruikt", async () => {
  const png = transparentPng(300, 300);
  const { client, uploads } = fakeStorage();
  const m = mockFetch((url, method) => {
    if (method === "HEAD") return new Response(null, { status: 404 });
    if (url === "https://x.test/p.png") return new Response(new Blob([png as BlobPart]), { headers: { "content-type": "image/png" } });
    return new Response("?", { status: 404 });
  });
  try {
    const r = await prepareInstagramImages(client, "t1", ["https://x.test/p.png"]);
    ok(r.ok, "moet lukken");
    if (r.ok) {
      eq(r.converted, 1);
      ok(r.urls[0].startsWith("https://cdn.test/marketing-assets/t1/social/") && r.urls[0].endsWith(".jpg"), r.urls[0]);
    }
    eq(uploads.length, 1);
    eq(uploads[0].type, "image/jpeg");
  } finally { m.restore(); }
});

Deno.test("prepare: al omgezet beeld wordt hergebruikt zonder opnieuw te downloaden", async () => {
  const { client, uploads } = fakeStorage();
  const m = mockFetch((_url, method) => (method === "HEAD" ? new Response(null, { status: 200 }) : new Response("x", { status: 500 })));
  try {
    const r = await prepareInstagramImages(client, "t1", ["https://x.test/p.png"]);
    ok(r.ok && r.converted === 0 && r.urls[0].endsWith(".jpg"), JSON.stringify(r));
    eq(m.calls.filter((c) => c.startsWith("GET")).length, 0, "geen download");
    eq(uploads.length, 0);
  } finally { m.restore(); }
});

Deno.test("prepare: JPEG zonder extensie (herkend aan de bytes) gaat ongewijzigd door", async () => {
  const { client, uploads } = fakeStorage();
  const m = mockFetch((_url, method) =>
    method === "HEAD" ? new Response(null, { status: 404 }) : new Response(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]) as BlobPart]), { headers: { "content-type": "application/octet-stream" } }));
  try {
    const r = await prepareInstagramImages(client, "t1", ["https://x.test/beeld?id=1"]);
    eq(r, { ok: true, urls: ["https://x.test/beeld?id=1"], converted: 0 });
    eq(uploads.length, 0);
  } finally { m.restore(); }
});

Deno.test("prepare: WebP, te veel beelden en downloadfouten geven een duidelijke fout", async () => {
  const { client } = fakeStorage();
  let m = mockFetch((_u, method) =>
    method === "HEAD" ? new Response(null, { status: 404 }) : new Response(new Blob([new TextEncoder().encode("RIFF0000WEBPVP8 ") as BlobPart]), { headers: { "content-type": "image/webp" } }));
  try {
    const r = await prepareInstagramImages(client, "t1", ["https://x.test/a.webp"]);
    ok(!r.ok && r.error.includes("WebP") === false && r.error.includes("image/webp") && r.retryable === false, JSON.stringify(r));
  } finally { m.restore(); }

  const elf = Array.from({ length: 11 }, (_, i) => `https://x.test/${i}.jpg`);
  const many = await prepareInstagramImages(client, "t1", elf);
  ok(!many.ok && many.error.includes("maximaal 10") && many.retryable === false, JSON.stringify(many));

  m = mockFetch((_u, method) => (method === "HEAD" ? new Response(null, { status: 404 }) : new Response("x", { status: 503 })));
  try {
    const r = await prepareInstagramImages(client, "t1", ["https://x.test/p.png"]);
    ok(!r.ok && r.retryable === true, "503 is tijdelijk: " + JSON.stringify(r));
  } finally { m.restore(); }
});

Deno.test("prepare (SOCIAL-2): externe JPEG wordt ongewijzigd naar de eigen opslag gekopieerd", async () => {
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const { client, uploads } = fakeStorage();
  const m = mockFetch((url, method) => {
    if (method === "HEAD") return new Response(null, { status: 404 });
    if (url.startsWith("https://raw.githubusercontent.com/")) {
      return new Response(new Blob([jpg as BlobPart]), { headers: { "content-type": "image/jpeg" } });
    }
    return new Response("?", { status: 404 });
  });
  try {
    const own = "https://cdn.test/marketing-assets/t1/social/al-van-ons.jpg";
    const r = await prepareInstagramImages(client, "t1", [
      "https://raw.githubusercontent.com/x/y/main/post.jpg",
      own,
    ], { ownHost: "cdn.test" });
    ok(r.ok, JSON.stringify(r));
    if (r.ok) {
      eq(r.converted, 1);
      ok(r.urls[0].startsWith("https://cdn.test/marketing-assets/t1/social/") && r.urls[0] !== own, r.urls[0]);
      eq(r.urls[1], own, "eigen opslag gaat ongewijzigd door");
    }
    eq(uploads.length, 1);
    eq(uploads[0].size, jpg.length, "JPEG-bytes ongewijzigd gekopieerd");
  } finally { m.restore(); }
});

// --- SOCIAL-3: video voor reels -----------------------------------------------------------
import { isMp4, MAX_REEL_BYTES, prepareInstagramVideo } from "./socialMedia.ts";
import { manualReminderText } from "./socialReminder.ts";

function fakeMp4(size = 64): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(new ArrayBuffer(size));
  b.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]); // ....ftypisom
  return b;
}

Deno.test("video: herkent MP4 aan ftyp", () => {
  eq([isMp4(fakeMp4()), isMp4(new Uint8Array(64))], [true, false]);
});

Deno.test("video: video in eigen opslag gaat ongewijzigd door, zonder call", async () => {
  const { client, uploads } = fakeStorage();
  const m = mockFetch(() => new Response("nee", { status: 500 }));
  try {
    const r = await prepareInstagramVideo(client, "t1", "https://own.test/a.mp4", { ownHost: "own.test" });
    eq(r, { ok: true, url: "https://own.test/a.mp4", copied: false });
    eq([m.calls.length, uploads.length], [0, 0]);
  } finally { m.restore(); }
});

Deno.test("video: externe MP4 wordt als video/mp4 naar de eigen opslag gekopieerd", async () => {
  const { client, uploads } = fakeStorage();
  const m = mockFetch((_u, method) => method === "HEAD" ? new Response(null, { status: 404 }) : new Response(new Blob([fakeMp4(2048)])));
  try {
    const r = await prepareInstagramVideo(client, "t1", "https://raw.githubusercontent.com/x/reel.mp4", { ownHost: "own.test" });
    ok(r.ok && r.copied && r.url.startsWith("https://cdn.test/marketing-assets/t1/social/") && r.url.endsWith(".mp4"), JSON.stringify(r));
    eq(uploads.map((u) => [u.type, u.size]), [["video/mp4", 2048]]);
  } finally { m.restore(); }
});

Deno.test("video: al gekopieerd → hergebruik zonder download", async () => {
  const { client, uploads } = fakeStorage();
  const m = mockFetch((_u, method) => method === "HEAD" ? new Response(null, { status: 200 }) : new Response("x", { status: 500 }));
  try {
    const r = await prepareInstagramVideo(client, "t1", "https://elders.test/reel.mp4", { ownHost: "own.test" });
    eq([r.ok, r.ok && r.copied, uploads.length], [true, false, 0]);
  } finally { m.restore(); }
});

Deno.test("video: geen MP4 of te groot → blijvende fout met uitleg", async () => {
  const { client } = fakeStorage();
  let m = mockFetch((_u, method) => method === "HEAD" ? new Response(null, { status: 404 }) : new Response(new Blob([new Uint8Array(64)])));
  try {
    const r = await prepareInstagramVideo(client, "t1", "https://elders.test/a.mov", { ownHost: "own.test" });
    eq([r.ok, !r.ok && r.retryable], [false, false]);
  } finally { m.restore(); }
  m = mockFetch((_u, method) => method === "HEAD" ? new Response(null, { status: 404 }) : new Response(new Blob([fakeMp4(MAX_REEL_BYTES + 1)])));
  try {
    const r = await prepareInstagramVideo(client, "t1", "https://elders.test/groot.mp4", { ownHost: "own.test" });
    ok(!r.ok && !r.retryable && r.error.includes("10 MB"), JSON.stringify(r));
  } finally { m.restore(); }
});

Deno.test("herinnering: tekst per soort, uur in Brussel", () => {
  const at = "2026-10-25T18:00:00Z"; // 19:00 in Brussel (wintertijd)
  const reel = manualReminderText({ media_type: "reel", manual_reason: "music", post_text: "cap", scheduled_for: at });
  ok(reel.title.startsWith("Reel") && reel.message.includes("19:00"), JSON.stringify(reel));
  const story = manualReminderText({ media_type: "story", manual_reason: "sticker", post_text: "Story: poll-sticker", scheduled_for: "2026-10-17T16:05:00Z" });
  ok(story.title.startsWith("Story") && story.message.includes("18:05") && story.message.includes("poll-sticker"), JSON.stringify(story));
});
