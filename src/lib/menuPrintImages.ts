// MENUKAART-PRINT-1 — afbeeldingen voor de PDF ophalen in de browser. pdf-lib kent enkel png en
// jpg; productfoto's zijn vaak webp of 5–15 MB groot. Daarom: ophalen, via een canvas verkleinen
// (en zo nodig naar jpg/png omzetten). Lukt het canvas niet, dan de ruwe png/jpg; anders null —
// de aanroeper meldt dat (geen stille gaten, R4).
import type { PdfImageBytes } from '@/utils/menuCardPdf';

const kindOf = (b: Uint8Array): PdfImageBytes['kind'] | null =>
  b[0] === 0x89 && b[1] === 0x50 ? 'png' : b[0] === 0xff && b[1] === 0xd8 ? 'jpg' : null;

async function viaCanvas(blob: Blob, maxPx: number, keepAlpha: boolean): Promise<PdfImageBytes | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * k));
  canvas.height = Math.max(1, Math.round(bmp.height * k));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (!keepAlpha) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const type = keepAlpha ? 'image/png' : 'image/jpeg';
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.86));
  if (!out) return null;
  return { bytes: new Uint8Array(await out.arrayBuffer()), kind: keepAlpha ? 'png' : 'jpg' };
}

/**
 * @param maxPx  langste zijde na verkleinen (kaft ±2000 px = ruim 300 dpi op A5)
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
  // Kleine png/jpg: zoals hij is (geen kwaliteitsverlies).
  if (kind && raw.byteLength < 600_000) return { bytes: raw, kind };
  try {
    const out = await viaCanvas(blob, maxPx, keepAlpha && kind !== 'jpg');
    if (out) return out;
  } catch {
    /* canvas mislukt (bv. heic): hieronder de ruwe bytes als die bruikbaar zijn */
  }
  return kind ? { bytes: raw, kind } : null;
}
