// MENUKAART-PRINT-1 — afbeeldingen voor de PDF ophalen in de browser. pdf-lib kent enkel png en
// jpg; productfoto's zijn vaak webp of 5–15 MB groot, logo's soms svg. Daarom: ophalen en via een
// canvas verkleinen tot max `maxPx` op de lange zijde (en zo nodig naar jpg/png omzetten), zodat de
// PDF ook op een gsm klein blijft. Lukt het canvas niet, dan de ruwe png/jpg; anders null — de
// aanroeper meldt dat (geen stille gaten, R4).
import type { PdfImageBytes } from '@/utils/menuCardPdf';

const kindOf = (b: Uint8Array): PdfImageBytes['kind'] | null =>
  b[0] === 0x89 && b[1] === 0x50 ? 'png' : b[0] === 0xff && b[1] === 0xd8 ? 'jpg' : null;

const isSvg = (blob: Blob, raw: Uint8Array) =>
  /svg/.test(blob.type) || /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(new TextDecoder().decode(raw.slice(0, 256)));

/** Breedte/hoogte uit de png-kop (IHDR) of jpg-SOF; null als onbekend. */
function dimensions(b: Uint8Array, kind: PdfImageBytes['kind']): [number, number] | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (kind === 'png' && b.length > 24) return [dv.getUint32(16), dv.getUint32(20)];
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [dv.getUint16(i + 7), dv.getUint16(i + 5)];
    i += 2 + dv.getUint16(i + 2);
  }
  return null;
}

/** Een svg heeft geen pixels: via <img> laden (createImageBitmap kan geen svg-blob in elke browser). */
function svgImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([blob], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 0); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('svg')); };
    img.src = url;
  });
}

async function viaCanvas(blob: Blob, svg: boolean, maxPx: number, keepAlpha: boolean): Promise<PdfImageBytes | null> {
  if (typeof document === 'undefined') return null;
  let src: CanvasImageSource; let w: number; let h: number;
  if (svg) {
    const img = await svgImage(blob);
    // Svg zonder vaste maat: 1200 px breed als vertrekpunt; vectoren worden op maxPx scherp gerenderd.
    w = img.naturalWidth || 1200; h = img.naturalHeight || Math.round(w / 3);
    const up = maxPx / Math.max(w, h);
    w = Math.round(w * up); h = Math.round(h * up);
    src = img;
  } else {
    if (typeof createImageBitmap !== 'function') return null;
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
    w = Math.max(1, Math.round(bmp.width * k)); h = Math.max(1, Math.round(bmp.height * k));
    src = bmp;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (!keepAlpha) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  (src as ImageBitmap).close?.();
  const type = keepAlpha ? 'image/png' : 'image/jpeg';
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.85));
  if (!out) return null;
  return { bytes: new Uint8Array(await out.arrayBuffer()), kind: keepAlpha ? 'png' : 'jpg' };
}

/**
 * @param maxPx  langste zijde na verkleinen (kaft 2400 px ≈ 400 dpi op A5; logo 1200 px)
 * @param keepAlpha  png met transparantie bewaren (logo's); anders jpg op wit
 */
export async function loadPdfImage(url: string | null | undefined, maxPx: number, keepAlpha: boolean): Promise<PdfImageBytes | null> {
  if (!url) return null;
  let blob: Blob;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    blob = await res.blob();
  } catch {
    return null;
  }
  const raw = new Uint8Array(await blob.arrayBuffer());
  const kind = kindOf(raw);
  const svg = !kind && isSvg(blob, raw);
  // png/jpg die al klein genoeg is (bytes én pixels): zoals hij is, zonder kwaliteitsverlies.
  const dim = kind ? dimensions(raw, kind) : null;
  if (kind && raw.byteLength < 400_000 && dim && Math.max(...dim) <= maxPx) return { bytes: raw, kind };
  try {
    const out = await viaCanvas(blob, svg, maxPx, keepAlpha && kind !== 'jpg');
    if (out) return out;
  } catch {
    /* canvas mislukt (bv. heic of kapotte svg): hieronder de ruwe bytes als die bruikbaar zijn */
  }
  return kind ? { bytes: raw, kind } : null;
}
