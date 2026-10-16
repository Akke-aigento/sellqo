// PHOTO-STD-1 (16-10-2026) — productfoto's in de standaardvorm van de winkel zetten.
//
// Aanleiding: AI-tools en fotografen leveren elk een ander formaat (vierkant, breed, staand),
// waardoor producten op de site ongelijk groot ogen of bijgesneden worden. De winkel legt
// één vorm vast (tenant_media_settings); deze module zet elke foto in die vorm:
//   1. randkleur bepalen (effen achtergrond?),
//   2. de lege rand rond het product wegknippen (alleen bij een effen achtergrond),
//   3. het product gecentreerd op een vast canvas zetten met een vaste marge.
// Er gaat nooit iets van het product verloren: we schalen, we snijden niet in het product.
//
// De rekenfuncties zijn puur (testbaar); renderStandardized() gebruikt canvas en draait
// alleen in de browser.

export interface PhotoStandardSettings {
  enabled: boolean;
  aspect_w: number;
  aspect_h: number;
  target_width: number;
  /** 'auto' | 'transparent' | '#rrggbb' */
  background: string;
  margin_pct: number;
  auto_trim: boolean;
  apply_on_upload: boolean;
}

export const DEFAULT_PHOTO_STANDARD: PhotoStandardSettings = {
  enabled: false,
  aspect_w: 3,
  aspect_h: 4,
  target_width: 1200,
  background: 'auto',
  margin_pct: 8,
  auto_trim: true,
  apply_on_upload: true,
};

/** Dambord achter een transparant voorbeeld (inline-stijl, gedeeld door de fotocomponenten). */
export const CHECKER_STYLE = {
  backgroundImage:
    'linear-gradient(45deg,#e5e7eb 25%,transparent 25%,transparent 75%,#e5e7eb 75%),linear-gradient(45deg,#e5e7eb 25%,transparent 25%,transparent 75%,#e5e7eb 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 8px 8px',
} as const;

export const ASPECT_PRESETS: { w: number; h: number }[] = [
  { w: 3, h: 4 },
  { w: 4, h: 5 },
  { w: 2, h: 3 },
  { w: 1, h: 1 },
  { w: 4, h: 3 },
];

export interface Rgba { r: number; g: number; b: number; a: number }
export interface Box { x: number; y: number; w: number; h: number }
export interface PixelGrid { data: Uint8ClampedArray | number[]; width: number; height: number }

/** Doelafmetingen uit de instellingen. */
export function targetSize(s: Pick<PhotoStandardSettings, 'aspect_w' | 'aspect_h' | 'target_width'>): { width: number; height: number } {
  const width = Math.round(s.target_width);
  return { width, height: Math.round((width * s.aspect_h) / s.aspect_w) };
}

/** Wijkt een beeld meer dan `tol` (relatief) af van de standaardverhouding? */
export function isOffStandard(width: number | null | undefined, height: number | null | undefined, s: Pick<PhotoStandardSettings, 'aspect_w' | 'aspect_h'>, tol = 0.02): boolean {
  if (!width || !height) return false;
  const want = s.aspect_w / s.aspect_h;
  const have = width / height;
  return Math.abs(have - want) / want > tol;
}

export function hexToRgba(hex: string): Rgba | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 255 };
}

export function rgbaToHex(c: Rgba): string {
  return '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function px(img: PixelGrid, x: number, y: number): Rgba {
  const i = (y * img.width + x) * 4;
  const d = img.data;
  return { r: d[i], g: d[i + 1], b: d[i + 2], a: d[i + 3] };
}

/** Of een pixel tot de achtergrond hoort (transparant telt altijd als achtergrond). */
export function isBackground(p: Rgba, bg: Rgba, tol: number): boolean {
  if (p.a < 16) return true;
  if (bg.a < 16) return false;
  return Math.abs(p.r - bg.r) <= tol && Math.abs(p.g - bg.g) <= tol && Math.abs(p.b - bg.b) <= tol;
}

/**
 * De randkleur, als de rand (vrijwel) effen is. `null` bij een foto met een echte
 * achtergrond (straat, studio met verloop): dan knippen we niets weg.
 */
export function detectBorderColor(img: PixelGrid, tol = 18, minShare = 0.9): Rgba | null {
  const { width: w, height: h } = img;
  if (w < 2 || h < 2) return null;
  const samples: Rgba[] = [];
  const stepX = Math.max(1, Math.floor(w / 200));
  const stepY = Math.max(1, Math.floor(h / 200));
  for (let x = 0; x < w; x += stepX) { samples.push(px(img, x, 0)); samples.push(px(img, x, h - 1)); }
  for (let y = 0; y < h; y += stepY) { samples.push(px(img, 0, y)); samples.push(px(img, w - 1, y)); }

  const transparent = samples.filter((s) => s.a < 16).length;
  if (transparent / samples.length >= minShare) return { r: 0, g: 0, b: 0, a: 0 };

  const opaque = samples.filter((s) => s.a >= 16);
  const median = (k: keyof Rgba) => {
    const v = opaque.map((s) => s[k]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  const bg: Rgba = { r: median('r'), g: median('g'), b: median('b'), a: 255 };
  const close = samples.filter((s) => isBackground(s, bg, tol)).length;
  return close / samples.length >= minShare ? bg : null;
}

/** Kleinste kader rond alles wat geen achtergrond is. `null` als het beeld leeg is. */
export function findContentBox(img: PixelGrid, bg: Rgba, tol = 18): Box | null {
  const { width: w, height: h } = img;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isBackground(px(img, x, y), bg, tol)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Vergroot een kader met `pad` pixels, binnen de grenzen van het beeld. */
export function padBox(box: Box, pad: number, w: number, h: number): Box {
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  return { x, y, w: Math.min(w, box.x + box.w + pad) - x, h: Math.min(h, box.y + box.h + pad) - y };
}

/**
 * Waar het bronkader op het doelcanvas komt: zo groot mogelijk binnen de marge,
 * verhouding behouden, gecentreerd.
 */
export function fitIntoFrame(src: { w: number; h: number }, target: { width: number; height: number }, marginPct: number): Box {
  const margin = (Math.max(0, Math.min(30, marginPct)) / 100) * Math.min(target.width, target.height);
  const availW = Math.max(1, target.width - 2 * margin);
  const availH = Math.max(1, target.height - 2 * margin);
  const scale = Math.min(availW / src.w, availH / src.h);
  const w = src.w * scale;
  const h = src.h * scale;
  return { x: (target.width - w) / 2, y: (target.height - h) / 2, w, h };
}

/** De achtergrond die het resultaat krijgt; null = transparant. */
export function resolveBackground(setting: string, detected: Rgba | null): Rgba | null {
  if (setting === 'transparent') return null;
  if (setting !== 'auto') return hexToRgba(setting) ?? { r: 255, g: 255, b: 255, a: 255 };
  if (detected && detected.a >= 16) return detected;
  if (detected && detected.a < 16) return null; // transparante bron blijft transparant
  return { r: 255, g: 255, b: 255, a: 255 };
}

export interface StandardPlan {
  /** Deel van de bron dat we gebruiken (bronpixels). */
  source: Box;
  /** Waar dat deel op het doelcanvas komt. */
  dest: Box;
  target: { width: number; height: number };
  background: Rgba | null;
  trimmed: boolean;
}

/**
 * Het volledige plan voor één beeld. `analysis` is een (eventueel verkleinde) kopie van de
 * pixels; `scale` = bronbreedte / analysebreedte, om het kader terug te rekenen.
 */
export function planStandardization(
  analysis: PixelGrid,
  scale: number,
  source: { width: number; height: number },
  s: PhotoStandardSettings,
): StandardPlan {
  const target = targetSize(s);
  const detected = detectBorderColor(analysis);
  let box: Box = { x: 0, y: 0, w: source.width, h: source.height };
  let trimmed = false;
  if (s.auto_trim && detected) {
    const content = findContentBox(analysis, detected);
    if (content) {
      // 1 analysepixel speling, zodat zachte randen (anti-aliasing) niet wegvallen.
      const padded = padBox(content, 1, analysis.width, analysis.height);
      box = {
        x: Math.max(0, Math.floor(padded.x * scale)),
        y: Math.max(0, Math.floor(padded.y * scale)),
        w: Math.min(source.width, Math.ceil(padded.w * scale)),
        h: Math.min(source.height, Math.ceil(padded.h * scale)),
      };
      trimmed = box.w < source.width || box.h < source.height;
    }
  }
  return {
    source: box,
    dest: fitIntoFrame({ w: box.w, h: box.h }, target, s.margin_pct),
    target,
    background: resolveBackground(s.background, detected),
    trimmed,
  };
}

/** Handmatige bijsturing in de bewerker (EDITOR-2). */
export interface FrameAdjust {
  /** Kwartslagen met de klok mee: 0, 90, 180 of 270. */
  rotate?: 0 | 90 | 180 | 270;
  /** 1 = passend binnen de marge; >1 groter (mag over de marge), <1 kleiner. */
  zoom?: number;
  /** Verschuiving in procent van de doelbreedte/-hoogte (-50..50). */
  offsetX?: number;
  offsetY?: number;
}

/** Past zoom en verschuiving toe op een geplaatst kader, rond het midden van het doel. */
export function adjustDest(dest: Box, target: { width: number; height: number }, adj: FrameAdjust = {}): Box {
  const zoom = Math.max(0.2, Math.min(4, adj.zoom ?? 1));
  const cx = dest.x + dest.w / 2 + ((adj.offsetX ?? 0) / 100) * target.width;
  const cy = dest.y + dest.h / 2 + ((adj.offsetY ?? 0) / 100) * target.height;
  const w = dest.w * zoom;
  const h = dest.h * zoom;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

// ── Browser ─────────────────────────────────────────────────────────────────────────

const ANALYSIS_MAX = 600;

export interface StandardizedImage {
  blob: Blob;
  width: number;
  height: number;
  contentType: string;
  trimmed: boolean;
  previewUrl: string;
}

/** Zet één beeld in de standaardvorm. Werkt met een Blob (upload) of een opgehaalde foto. */
export async function renderStandardized(input: Blob, s: PhotoStandardSettings, adj: FrameAdjust = {}): Promise<StandardizedImage> {
  const raw = await createImageBitmap(input);
  // Eerst draaien, zodat analyse en plaatsing op het gedraaide beeld gebeuren.
  let bmp: ImageBitmap = raw;
  if (adj.rotate) {
    const quarter = adj.rotate === 90 || adj.rotate === 270;
    const rc = document.createElement('canvas');
    rc.width = quarter ? raw.height : raw.width;
    rc.height = quarter ? raw.width : raw.height;
    const rctx = rc.getContext('2d')!;
    rctx.translate(rc.width / 2, rc.height / 2);
    rctx.rotate((adj.rotate * Math.PI) / 180);
    rctx.drawImage(raw, -raw.width / 2, -raw.height / 2);
    bmp = await createImageBitmap(rc);
    raw.close?.();
  }
  try {
    const ratio = Math.min(1, ANALYSIS_MAX / Math.max(bmp.width, bmp.height));
    const aw = Math.max(1, Math.round(bmp.width * ratio));
    const ah = Math.max(1, Math.round(bmp.height * ratio));
    const ac = document.createElement('canvas');
    ac.width = aw;
    ac.height = ah;
    const actx = ac.getContext('2d', { willReadFrequently: true })!;
    actx.drawImage(bmp, 0, 0, aw, ah);
    const analysis = actx.getImageData(0, 0, aw, ah);

    const plan = planStandardization(analysis, bmp.width / aw, { width: bmp.width, height: bmp.height }, s);

    const out = document.createElement('canvas');
    out.width = plan.target.width;
    out.height = plan.target.height;
    const ctx = out.getContext('2d')!;
    if (plan.background) {
      ctx.fillStyle = rgbaToHex(plan.background);
      ctx.fillRect(0, 0, out.width, out.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const dest = adjustDest(plan.dest, plan.target, adj);
    ctx.drawImage(bmp, plan.source.x, plan.source.y, plan.source.w, plan.source.h, dest.x, dest.y, dest.w, dest.h);

    // Effen achtergrond → JPEG (klein, overal ondersteund: feeds, mails). Transparant → PNG.
    const contentType = plan.background ? 'image/jpeg' : 'image/png';
    const blob = await new Promise<Blob>((resolve, reject) =>
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas leeg'))), contentType, 0.9));
    return { blob, width: out.width, height: out.height, contentType, trimmed: plan.trimmed, previewUrl: URL.createObjectURL(blob) };
  } finally {
    bmp.close?.();
  }
}

/** Haalt een bestaande foto op (eigen storage en de Shopify-CDN sturen CORS *). */
export async function fetchImageBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}
