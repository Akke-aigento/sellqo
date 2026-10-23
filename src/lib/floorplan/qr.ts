// ZAAL-H1 — QR-link per tafel. De storefront leest ?t=<token> (en niet meer het vrij
// te typen ?tafel=<label>) zodra een zaak een zaalplan heeft.

/** Zelfde vorm als de check in de migratie (24 hex-tekens standaard). */
export const TOKEN_RE = /^[0-9a-f]{24,64}$/;

export function tableQrUrl(slug: string, token: string): string {
  return `https://${slug}.sellqo.shop/menu?t=${encodeURIComponent(token)}`;
}

/** In stukken van n (stickers: 12 per A4). */
export function chunk<T>(xs: T[], n: number): T[][] {
  const size = Math.max(1, Math.floor(n));
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/** Plaats van sticker i op een A4 (3 kolommen × 4 rijen), in mm vanaf linksboven. */
export function stickerCell(i: number): { col: number; row: number; x: number; y: number; w: number; h: number } {
  const margin = 8;
  const gap = 4;
  const cols = 3;
  const rows = 4;
  const w = (210 - 2 * margin - (cols - 1) * gap) / cols;
  const h = (297 - 2 * margin - (rows - 1) * gap) / rows;
  const k = ((i % 12) + 12) % 12;
  const col = k % cols;
  const row = Math.floor(k / cols);
  return { col, row, x: margin + col * (w + gap), y: margin + row * (h + gap), w, h };
}
