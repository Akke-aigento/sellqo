// SOCIAL-1c — beelden klaarmaken voor Instagram.
//
// Instagram aanvaardt enkel JPEG, met een beeldverhouding tussen 4:5 (0,8) en
// 1,91:1. SellQo-productfoto's zijn vaak PNG met transparantie (Loveke: allemaal).
// Zonder deze stap weigerde socialPublish elke post met zo'n foto.
//
// Wat dit doet, per beeld:
//   - .jpg/.jpeg in de URL: ongewijzigd doorgeven (Instagram haalt het zelf op).
//   - anders: ophalen; is het toch JPEG (content-type), ongewijzigd doorgeven.
//   - PNG: decoderen, transparantie op wit leggen, te brede beelden
//     verkleinen tot 1440 px, buiten 4:5..1,91:1 aanvullen met witte randen,
//     als JPEG (kwaliteit 90) opslaan in de publieke bucket marketing-assets onder
//     <tenant>/social/<sha256 van de bron-URL>.jpg, en die URL gebruiken.
//   - Bestaat dat bestand al, dan wordt het hergebruikt zonder opnieuw om te zetten.
//   - Andere formaten (WebP, GIF, AVIF, HEIC): duidelijke fout, geen gok.
//
// Bibliotheken: fast-png + jpeg-js, allebei pure JavaScript. NIET imagescript: het
// npm-pakket laadt een native binary via FFI, en dat bestaat niet op Supabase Edge
// (gevonden in de unit test zonder --allow-ffi, 15-10).
// Kost (gemeten zonder extra rechten, 15-10): ±180 ms CPU voor 1000x1000.

import { decode as decodePng } from "npm:fast-png@6.3.0";
import jpeg from "npm:jpeg-js@0.4.4";

export const MAX_INSTAGRAM_IMAGES = 10;
const MAX_WIDTH = 1440;
const MIN_RATIO = 0.8; // 4:5
const MAX_RATIO = 1.91;
const BUCKET = "marketing-assets";

// Losse structuur i.p.v. SupabaseClient (zelfde reden als cronAuth.ts).
export interface SocialStorageClient {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Uint8Array,
        options: { contentType: string; upsert: boolean; cacheControl?: string },
      ) => Promise<{ error: { message: string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
}

export type PrepareResult =
  | { ok: true; urls: string[]; converted: number }
  | { ok: false; error: string; retryable: boolean };

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function isJpegUrl(url: string): boolean {
  try {
    return /\.(jpe?g)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Bestaat het omgezette bestand al? Dan hoeven we niets opnieuw te doen. */
async function exists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

export type ImageKind = "jpeg" | "png" | "other";

/** Herkent het formaat aan de eerste bytes (betrouwbaarder dan extensie of content-type). */
export function sniffImage(bytes: Uint8Array): ImageKind {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  return "other";
}

/** PNG (elke kleurdiepte, palet, grijs, alfa) naar RGBA 8-bit, op een witte achtergrond. */
function pngToRgbOnWhite(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const png = decodePng(bytes);
  const { width, height, channels, depth, palette } = png;
  const src = png.data as ArrayLike<number>;
  const shift = depth === 16 ? 8 : 0;
  const max = depth === 16 ? 255 : (1 << Math.min(depth, 8)) - 1; // na de shift
  const rgba = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    let r: number, g: number, b: number, a = 255;
    if (palette) {
      const entry = palette[src[p]] ?? [0, 0, 0, 255];
      [r, g, b] = entry;
      a = entry.length > 3 ? entry[3] : 255;
    } else if (channels === 1 || channels === 2) {
      const v = (src[p * channels] >> shift) * 255 / max;
      r = g = b = v;
      if (channels === 2) a = (src[p * 2 + 1] >> shift) * 255 / max;
    } else {
      r = (src[p * channels] >> shift) * 255 / max;
      g = (src[p * channels + 1] >> shift) * 255 / max;
      b = (src[p * channels + 2] >> shift) * 255 / max;
      if (channels === 4) a = (src[p * 4 + 3] >> shift) * 255 / max;
    }
    const f = a / 255;
    const o = p * 4;
    rgba[o] = r * f + 255 * (1 - f);
    rgba[o + 1] = g * f + 255 * (1 - f);
    rgba[o + 2] = b * f + 255 * (1 - f);
    rgba[o + 3] = 255;
  }
  return { width, height, rgba };
}

/** Verkleint met gemiddelde over het bronvak (box filter): scherp genoeg, geen aliasing. */
function downscale(src: Uint8Array, w: number, h: number, nw: number, nh: number): Uint8Array {
  const out = new Uint8Array(nw * nh * 4);
  const sx = w / nw, sy = h / nh;
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < h; yy++) {
        for (let xx = x0; xx < x1 && xx < w; xx++) {
          const i = (yy * w + xx) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; n++;
        }
      }
      const o = (y * nw + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return out;
}

/**
 * Zet een PNG om naar een Instagram-geschikte JPEG: wit onder transparantie,
 * maximaal 1440 px breed, witte randen tot de verhouding binnen 4:5..1,91:1 valt.
 * Geëxporteerd voor de unit tests; geen netwerk.
 */
export function toInstagramJpeg(bytes: Uint8Array): Uint8Array {
  if (sniffImage(bytes) !== "png") throw new Error("enkel PNG kan omgezet worden");
  let { width, height, rgba } = pngToRgbOnWhite(bytes);
  if (width > MAX_WIDTH) {
    const nh = Math.round(height * MAX_WIDTH / width);
    rgba = downscale(rgba, width, height, MAX_WIDTH, nh);
    width = MAX_WIDTH;
    height = nh;
  }

  const ratio = width / height;
  let cw = width, ch = height;
  if (ratio < MIN_RATIO) cw = Math.ceil(height * MIN_RATIO); // te hoog: breder maken
  if (ratio > MAX_RATIO) ch = Math.ceil(width / MAX_RATIO); // te breed: hoger maken
  let canvas = rgba;
  if (cw !== width || ch !== height) {
    canvas = new Uint8Array(cw * ch * 4).fill(255);
    const ox = Math.floor((cw - width) / 2), oy = Math.floor((ch - height) / 2);
    for (let y = 0; y < height; y++) {
      canvas.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), ((y + oy) * cw + ox) * 4);
    }
  }
  const encoded = jpeg.encode({ data: canvas, width: cw, height: ch }, 90);
  return new Uint8Array(encoded.data);
}

/**
 * Maakt de beeld-URL's van een post klaar voor Instagram.
 * Geeft altijd JPEG-URL's terug, of een fout die de tenant begrijpt.
 */
export async function prepareInstagramImages(
  storage: SocialStorageClient,
  tenantId: string,
  urls: string[],
  /**
   * SOCIAL-2: host van de eigen Supabase-opslag. Beelden van elders (bv. GitHub, waar
   * de weektaak zijn renders zet) worden dan ook gekopieerd, zodat een post niet afhangt
   * van een externe host en Instagram altijd uit onze opslag haalt.
   */
  options: { ownHost?: string } = {},
): Promise<PrepareResult> {
  const clean = urls.filter(Boolean);
  if (clean.length > MAX_INSTAGRAM_IMAGES) {
    return { ok: false, retryable: false, error: `Instagram aanvaardt maximaal ${MAX_INSTAGRAM_IMAGES} beelden per post (deze post heeft er ${clean.length}).` };
  }

  const out: string[] = [];
  let converted = 0;
  for (const url of clean) {
    const external = !!options.ownHost && hostOf(url) !== options.ownHost;
    if (isJpegUrl(url) && !external) {
      out.push(url);
      continue;
    }

    const path = `${tenantId}/social/${await sha256Hex(url)}.jpg`;
    const publicUrl = storage.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    if (await exists(publicUrl)) {
      out.push(publicUrl);
      continue;
    }

    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      return { ok: false, retryable: true, error: `Beeld kon niet opgehaald worden (${(err as Error).message}).` };
    }
    if (!response.ok) {
      return { ok: false, retryable: response.status >= 500, error: `Beeld kon niet opgehaald worden (HTTP ${response.status}): ${url}` };
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const kind = sniffImage(bytes);
    if (kind === "jpeg" && !external) {
      out.push(url);
      continue;
    }
    if (kind === "other") {
      const type = response.headers.get("content-type") ?? "onbekend";
      return { ok: false, retryable: false, error: `Dit beeldformaat (${type}) kan SellQo niet omzetten voor Instagram. Gebruik JPEG of PNG.` };
    }

    let jpegBytes: Uint8Array;
    try {
      // Een externe JPEG gaat ongewijzigd mee (enkel gekopieerd); een PNG wordt omgezet.
      jpegBytes = kind === "jpeg" ? bytes : toInstagramJpeg(bytes);
    } catch (err) {
      return { ok: false, retryable: false, error: `Beeld kon niet omgezet worden naar JPEG: ${(err as Error).message}` };
    }

    const { error } = await storage.storage.from(BUCKET).upload(path, jpegBytes, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) {
      return { ok: false, retryable: true, error: `Omgezet beeld kon niet opgeslagen worden: ${error.message}` };
    }
    out.push(publicUrl);
    converted++;
  }
  return { ok: true, urls: out, converted };
}

// --- SOCIAL-3: video voor reels ------------------------------------------------------------

/** Bucket-limiet van marketing-assets (10 MB, storage.buckets.file_size_limit, 15-10). */
export const MAX_REEL_BYTES = 10 * 1024 * 1024;

/** MP4/MOV: bytes 4..8 zijn "ftyp". */
export function isMp4(bytes: Uint8Array): boolean {
  return bytes.length > 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
}

export type PrepareVideoResult =
  | { ok: true; url: string; copied: boolean }
  | { ok: false; error: string; retryable: boolean };

/**
 * Zet de video van een reel in de eigen opslag (marketing-assets/<tenant>/social/<sha>.mp4),
 * zodat Instagram altijd van SellQo haalt en het juiste content-type (video/mp4) krijgt.
 * Een video die al in de eigen opslag staat, gaat ongewijzigd door.
 */
export async function prepareInstagramVideo(
  storage: SocialStorageClient,
  tenantId: string,
  url: string,
  options: { ownHost?: string } = {},
): Promise<PrepareVideoResult> {
  if (!url) return { ok: false, retryable: false, error: "Deze reel heeft geen video." };
  if (options.ownHost && hostOf(url) === options.ownHost) return { ok: true, url, copied: false };

  const path = `${tenantId}/social/${await sha256Hex(url)}.mp4`;
  const publicUrl = storage.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  if (await exists(publicUrl)) return { ok: true, url: publicUrl, copied: false };

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    return { ok: false, retryable: true, error: `Video kon niet opgehaald worden (${(err as Error).message}).` };
  }
  if (!response.ok) {
    return { ok: false, retryable: response.status >= 500, error: `Video kon niet opgehaald worden (HTTP ${response.status}): ${url}` };
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_REEL_BYTES) {
    return { ok: false, retryable: false, error: `De video is ${(bytes.length / 1048576).toFixed(1)} MB; SellQo aanvaardt maximaal 10 MB per reel.` };
  }
  if (!isMp4(bytes)) {
    return { ok: false, retryable: false, error: "De video is geen MP4. Instagram-reels moeten MP4 (H.264, AAC) zijn." };
  }
  const { error } = await storage.storage.from(BUCKET).upload(path, bytes, {
    contentType: "video/mp4",
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) {
    return { ok: false, retryable: true, error: `Video kon niet opgeslagen worden: ${error.message}` };
  }
  return { ok: true, url: publicUrl, copied: true };
}
