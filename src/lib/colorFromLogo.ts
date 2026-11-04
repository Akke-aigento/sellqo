// Verhuisd uit StorefrontCustomize (UREN-1b): de merkkleur kies je in Branding.
// Meest voorkomende, verzadigde kleur uit het logo (wit, zwart en grijs tellen niet mee).
export async function colorFromLogo(url: string): Promise<string | null> {
  const img = new window.Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, 64, 64);
  const { data } = ctx.getImageData(0, 0, 64, 64);
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < 40 || min > 225 || max - min < 40) continue;
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  const best = [...buckets.values()].sort((x, y) => y.n - x.n)[0];
  if (!best) return null;
  return '#' + [best.r, best.g, best.b].map((v) => Math.round(v / best.n).toString(16).padStart(2, '0')).join('');
}

