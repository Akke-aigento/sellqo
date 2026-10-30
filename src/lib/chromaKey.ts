// BG-REMOVE-1 — echte transparantie voor "achtergrond verwijderen".
//
// Een beeldmodel (Gemini Flash Image) kan geen alfakanaal maken: vraag je "make it
// transparent", dan tekent het het grijs-witte dambord ín de foto. Daarom vraagt de edge
// function nu een effen sleutelkleur als achtergrond (magenta, of groen als het product zelf
// veel magenta bevat) en knippen we die hier weg tot een PNG met echte transparantie.
//
// Alleen pixels die via de rand met de achtergrond verbonden zijn, worden doorzichtig
// (flood fill). Een magenta detail midden in het product blijft dus staan.

export type KeyColor = 'magenta' | 'green';
export const KEY_RGB: Record<KeyColor, [number, number, number]> = {
  magenta: [255, 0, 255],
  green: [0, 255, 0],
};

const dist = (r: number, g: number, b: number, k: [number, number, number]) =>
  Math.sqrt((r - k[0]) ** 2 + (g - k[1]) ** 2 + (b - k[2]) ** 2);

/** Kies de sleutelkleur die het minst in de bronfoto voorkomt. */
export function pickKeyColor(rgba: Uint8ClampedArray): KeyColor {
  let nearMagenta = 0;
  let nearGreen = 0;
  for (let i = 0; i < rgba.length; i += 16) { // elke 4e pixel volstaat
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    if (dist(r, g, b, KEY_RGB.magenta) < 160) nearMagenta++;
    if (dist(r, g, b, KEY_RGB.green) < 160) nearGreen++;
  }
  return nearMagenta > nearGreen ? 'green' : 'magenta';
}

/** De werkelijke achtergrondkleur: mediaan van de randpixels die op de sleutelkleur lijken. */
function estimateBackground(rgba: Uint8ClampedArray, w: number, h: number, key: [number, number, number]) {
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (dist(rgba[i], rgba[i + 1], rgba[i + 2], key) < 140) { rs.push(rgba[i]); gs.push(rgba[i + 1]); bs.push(rgba[i + 2]); }
  };
  for (let x = 0; x < w; x++) { take(x, 0); take(x, h - 1); }
  for (let y = 0; y < h; y++) { take(0, y); take(w - 1, y); }
  if (rs.length < 8) return null; // geen effen rand: het model volgde de opdracht niet
  const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
  return [med(rs), med(gs), med(bs)] as [number, number, number];
}

/**
 * Knipt de achtergrond weg, in place. Geeft false terug als er geen herkenbare effen
 * achtergrond is (dan laten we de foto ongemoeid i.p.v. iets half weg te knippen).
 */
export function keyOut(
  rgba: Uint8ClampedArray, w: number, h: number, keyColor: KeyColor,
  opts: { inner?: number; outer?: number } = {},
): boolean {
  const bg = estimateBackground(rgba, w, h, KEY_RGB[keyColor]);
  if (!bg) return false;
  const inner = opts.inner ?? 60;   // tot hier: volledig achtergrond
  const outer = opts.outer ?? 150;  // vanaf hier: volledig product
  const n = w * h;
  const d = new Float32Array(n);
  for (let p = 0; p < n; p++) { const i = p * 4; d[p] = dist(rgba[i], rgba[i + 1], rgba[i + 2], bg); }

  // Flood fill vanaf de rand door alles wat nog "achtergrond-achtig" is (d < outer).
  const seen = new Uint8Array(n);
  const stack: number[] = [];
  const push = (p: number) => { if (!seen[p] && d[p] < outer) { seen[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }

  for (let p = 0; p < n; p++) {
    if (!seen[p]) continue;
    const i = p * 4;
    const a = Math.min(1, Math.max(0, (d[p] - inner) / (outer - inner)));
    if (a <= 0) { rgba[i + 3] = 0; continue; }
    // Despill: haal het aandeel achtergrondkleur uit de randpixel.
    for (let c = 0; c < 3; c++) {
      rgba[i + c] = Math.min(255, Math.max(0, Math.round((rgba[i + c] - (1 - a) * bg[c]) / a)));
    }
    rgba[i + 3] = Math.round(a * rgba[i + 3]);
  }
  return true;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url.includes('?') ? `${url}&ck=${Date.now()}` : `${url}?ck=${Date.now()}`;
  await img.decode();
  return img;
}

function toCanvas(img: HTMLImageElement, maxSide = 0) {
  const scale = maxSide ? Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight)) : 1;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { c, ctx };
}

/** Bronfoto analyseren (verkleind) om de sleutelkleur te kiezen. Faalt stil naar magenta. */
export async function pickKeyColorForUrl(url: string): Promise<KeyColor> {
  try {
    const { c, ctx } = toCanvas(await loadImage(url), 256);
    return pickKeyColor(ctx.getImageData(0, 0, c.width, c.height).data);
  } catch {
    return 'magenta';
  }
}

/** Resultaat van het model ophalen, sleutelkleur wegknippen, PNG teruggeven (null = niet gelukt). */
export async function keyOutUrl(url: string, keyColor: KeyColor): Promise<Blob | null> {
  const { c, ctx } = toCanvas(await loadImage(url));
  const data = ctx.getImageData(0, 0, c.width, c.height);
  if (!keyOut(data.data, c.width, c.height, keyColor)) return null;
  ctx.putImageData(data, 0, 0);
  return await new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}
