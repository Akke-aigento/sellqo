/**
 * MAIL-LOGO-1 — e-mailvariant van het winkellogo, client-side gemaakt bij het uploaden.
 *
 * Waarom: de kop van elke tenantmail (supabase/functions/_shared/tenantEmail.ts,
 * renderTenantEmailHeader) toont het logo 44 px hoog op een wit vlak. Een logo met brede lege of
 * witte randen werd daar een postzegel, een foto van 4000 px woog megabytes, en een SVG tonen
 * veel mailclients (Gmail, Outlook) helemaal niet. Daarom bij elke upload een PNG-variant:
 *
 *   • transparante en (bijna) witte randen weggeknipt (findTrimBox);
 *   • 176 px hoog (4× de weergave), proportioneel, max. 600 px breed, nooit vergroot
 *     (emailLogoSize); kleiner dan 88 px hoog → waarschuwing "wordt mogelijk wazig";
 *   • PNG met transparantie, doel < 100 KB (zo nodig in stappen kleiner, nooit onder 88 px);
 *   • SVG wordt via canvas gerasterd, ook zonder width/height (viewBox of standaardmaat).
 *
 * Het origineel blijft ongewijzigd (storefront). Enkel onleesbare of kapotte bestanden worden
 * geweigerd (EmailLogoError). De pure functies bovenaan hebben geen DOM nodig (vitest).
 */

export const EMAIL_LOGO_HEIGHT = 176;
export const EMAIL_LOGO_MAX_WIDTH = 600;
export const EMAIL_LOGO_MIN_SHARP_HEIGHT = 88;
export const EMAIL_LOGO_TARGET_BYTES = 100 * 1024;
/** Weergavehoogte in de mail (renderTenantEmailHeader). */
export const EMAIL_LOGO_DISPLAY_HEIGHT = 44;

/** Bovengrens voor het werkcanvas: een foto van 8000 px laadt anders honderden MB in het geheugen. */
const MAX_WORK_SIDE = 2400;
/** Rasterhoogte voor een SVG: ruim boven 176 px, zodat bijsnijden nog scherp eindigt. */
const SVG_RASTER_HEIGHT = 4 * EMAIL_LOGO_HEIGHT;
const SVG_DEFAULT = { width: 600, height: 176 };

export const EMAIL_LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';

export interface TrimBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Kader rond alles wat geen achtergrond is. Achtergrond = (bijna) transparant of (bijna) wit.
 * `null` als het hele beeld achtergrond is (bv. een wit logo op transparant): dan niet bijsnijden.
 */
export function findTrimBox(
  data: ArrayLike<number>,
  width: number,
  height: number,
  opts: { alphaThreshold?: number; whiteThreshold?: number } = {},
): TrimBox | null {
  const alphaMin = opts.alphaThreshold ?? 16;
  const white = opts.whiteThreshold ?? 245;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a < alphaMin) continue;
      if (data[i] >= white && data[i + 1] >= white && data[i + 2] >= white) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export interface EmailLogoSize {
  width: number;
  height: number;
  /** Bronhoogte (na bijsnijden) onder 88 px: in de mail mogelijk wazig. */
  blurry: boolean;
}

/**
 * Doelmaat: 176 px hoog, proportioneel, max. 600 px breed, nooit groter dan de bron.
 * `targetHeight` laat de compressiestap een lagere hoogte proberen.
 */
export function emailLogoSize(
  sourceWidth: number,
  sourceHeight: number,
  targetHeight = EMAIL_LOGO_HEIGHT,
): EmailLogoSize {
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) throw new RangeError('lege afbeelding');
  const scale = Math.min(targetHeight / sourceHeight, EMAIL_LOGO_MAX_WIDTH / sourceWidth, 1);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
    blurry: sourceHeight < EMAIL_LOGO_MIN_SHARP_HEIGHT,
  };
}

/** Hoogtes die de compressiestap probeert tot de PNG onder 100 KB zit (nooit onder 88 px). */
export function compressionHeights(): number[] {
  return [EMAIL_LOGO_HEIGHT, 154, 132, 110, EMAIL_LOGO_MIN_SHARP_HEIGHT];
}

/** Maat voor een SVG zonder bruikbare width/height: viewBox, anders 600×176. */
export function svgIntrinsicSize(attrs: {
  width?: string | null;
  height?: string | null;
  viewBox?: string | null;
}): { width: number; height: number } {
  const px = (v?: string | null) => {
    const m = /^\s*([0-9]*\.?[0-9]+)\s*(px)?\s*$/i.exec(v ?? '');
    const n = m ? parseFloat(m[1]) : NaN;
    return n > 0 ? n : null;
  };
  const vb = (attrs.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  const vbW = vb.length === 4 && vb[2] > 0 ? vb[2] : null;
  const vbH = vb.length === 4 && vb[3] > 0 ? vb[3] : null;
  const w = px(attrs.width);
  const h = px(attrs.height);
  if (w && h) return { width: w, height: h };
  if (vbW && vbH) {
    if (w) return { width: w, height: (w * vbH) / vbW };
    if (h) return { width: (h * vbW) / vbH, height: h };
    return { width: vbW, height: vbH };
  }
  return { ...SVG_DEFAULT };
}

/** Bestandsnaam van de variant: `<tenant>/email-logo-<hash>.png`. */
export function emailLogoPath(tenantId: string, hash: string): string {
  return `${tenantId}/email-logo-${hash}.png`;
}

// ── Browser ──────────────────────────────────────────────────────────

export type EmailLogoErrorCode = 'unreadable';

export class EmailLogoError extends Error {
  code: EmailLogoErrorCode;
  constructor(code: EmailLogoErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'EmailLogoError';
  }
}

export interface EmailLogoVariant {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  blurry: boolean;
  /** Eerste 16 hex-tekens van de SHA-256 van de PNG. */
  hash: string;
}

const isSvgFile = (file: File) =>
  file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '');

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new EmailLogoError('unreadable', 'decode failed'));
    img.src = src;
  });
}

async function decodeSvg(file: File): Promise<{ img: HTMLImageElement; width: number; height: number }> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) {
    throw new EmailLogoError('unreadable', 'svg parse failed');
  }
  const size = svgIntrinsicSize({
    width: svg.getAttribute('width'),
    height: svg.getAttribute('height'),
    viewBox: svg.getAttribute('viewBox'),
  });
  // Zonder width/height rendert een browser een SVG op 300×150 of op 0×0. Expliciet zetten,
  // op de rastermaat, zodat het resultaat scherp is en de verhouding klopt.
  const scale = SVG_RASTER_HEIGHT / size.height;
  const width = Math.max(1, Math.round(Math.min(size.width * scale, MAX_WORK_SIDE)));
  const height = Math.max(1, Math.round(width * (size.height / size.width)));
  if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    return { img: await loadImage(url), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeRaster(file: File): Promise<{ img: HTMLImageElement; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (!img.naturalWidth || !img.naturalHeight) throw new EmailLogoError('unreadable', 'empty image');
    return { img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvas2d(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new EmailLogoError('unreadable', 'no canvas');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return [c, ctx];
}

function toPng(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new EmailLogoError('unreadable', 'encode failed'))), 'image/png'),
  );
}

/** FNV-1a (64-bit via twee 32-bit helften): enkel als crypto.subtle ontbreekt (geen https-context). */
export function fnvHex(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ bytes[bytes.length - 1 - i], 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

async function sha256Hex(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!globalThis.crypto?.subtle) return fnvHex(bytes);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/** Maakt de e-mailvariant. Gooit EmailLogoError('unreadable') bij een onleesbaar bestand. */
export async function createEmailLogoVariant(file: File): Promise<EmailLogoVariant> {
  let decoded: { img: HTMLImageElement; width: number; height: number };
  try {
    decoded = isSvgFile(file) ? await decodeSvg(file) : await decodeRaster(file);
  } catch (e) {
    if (e instanceof EmailLogoError) throw e;
    throw new EmailLogoError('unreadable', String(e));
  }

  // Werkcanvas, begrensd in grootte.
  const workScale = Math.min(1, MAX_WORK_SIDE / Math.max(decoded.width, decoded.height));
  const ww = Math.max(1, Math.round(decoded.width * workScale));
  const wh = Math.max(1, Math.round(decoded.height * workScale));
  const [work, wctx] = canvas2d(ww, wh);
  wctx.drawImage(decoded.img, 0, 0, ww, wh);
  let pixels: ImageData;
  try {
    pixels = wctx.getImageData(0, 0, ww, wh);
  } catch (e) {
    throw new EmailLogoError('unreadable', String(e));
  }
  const box = findTrimBox(pixels.data, ww, wh) ?? { x: 0, y: 0, width: ww, height: wh };
  // "Wazig" gaat over de echte bron: een SVG is vector en dus nooit wazig.
  const sourceHeight = isSvgFile(file) ? Number.POSITIVE_INFINITY : box.height / workScale;

  let best: EmailLogoVariant | null = null;
  for (const target of compressionHeights()) {
    const size = emailLogoSize(box.width, box.height, target);
    // Geeft deze stap geen kleiner beeld (kleine of zeer brede bron), dan niets te winnen.
    if (best && size.height >= best.height) continue;
    const [out, octx] = canvas2d(size.width, size.height);
    octx.drawImage(work, box.x, box.y, box.width, box.height, 0, 0, size.width, size.height);
    const blob = await toPng(out);
    best = {
      blob,
      width: size.width,
      height: size.height,
      bytes: blob.size,
      blurry: sourceHeight < EMAIL_LOGO_MIN_SHARP_HEIGHT,
      hash: '',
    };
    if (blob.size <= EMAIL_LOGO_TARGET_BYTES) break;
  }
  const result = best as EmailLogoVariant;
  result.hash = await sha256Hex(result.blob);
  return result;
}
