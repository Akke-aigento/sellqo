// MAIL-THEME-1 — WCAG-contrast tussen twee kleuren.
//
// Puur, geen imports: src/test/colorContrast.test.ts laadt dit rechtstreeks.
//
// Waarom: tenantEmail.ts nam de tekstkleur van het storefront-thema over
// (tenant_theme_settings.text_color) en zette die op de vaste witte mailcard.
// Bij een donker thema is die tekstkleur licht — VanXcel #f0f0f0, Astra Sleep
// #f5f5f5 — en werd de mail onleesbaar in elke lichte mailclient (18 sep 2026).

/** "#rgb" of "#rrggbb" → [r, g, b] in 0–255, of null als het geen hex is. */
function parseHex(color: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** Relatieve luminantie volgens WCAG 2.x. */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrastverhouding 1–21, of null als een van beide geen hexkleur is. */
export function contrastRatio(a: string, b: string): number | null {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return null;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA voor gewone tekst. */
export const MIN_TEXT_CONTRAST = 4.5;

/**
 * `candidate` als die leesbaar is op `background`, anders `fallback`.
 * Een kleur die niet te beoordelen is, telt als onleesbaar: liever de
 * standaardkleur dan tekst die niemand ziet.
 */
export function readableTextColor(
  candidate: string | null | undefined,
  background: string,
  fallback: string,
  minRatio = MIN_TEXT_CONTRAST,
): string {
  if (!candidate) return fallback;
  const ratio = contrastRatio(candidate, background);
  return ratio !== null && ratio >= minRatio ? candidate : fallback;
}
