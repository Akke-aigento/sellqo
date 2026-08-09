// Shared parsing helpers for the Printful product import (LOVEKE-POD-2).
// Pure functions only: no network, no database. Kept in _shared because both
// preview-printful-import and apply-printful-import rely on identical parsing.

export interface PrintfulSyncVariantRaw {
  id?: number;
  name?: string;
  sku?: string;
  retail_price?: string | number;
  product?: { image?: string; name?: string; size?: string; color?: string } | null;
  files?: Array<{ type?: string; preview_url?: string; url?: string; thumbnail_url?: string }> | null;
  options?: Array<{ id?: string; value?: unknown }> | null;
}

const SIZE_TOKENS = new Set([
  'xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl', '5xl', '6xl',
  'one size', 'onesize',
]);

function looksLikeSize(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (SIZE_TOKENS.has(v)) return true;
  // 38, 10.5, 8"x10", 24x36 …
  return /^[\d\s.,x×"'/-]+(cm|mm|inch|in|")?$/i.test(v);
}

/** Human-readable attribute labels, e.g. { "Maat": "L", "Kleur": "Zwart" }. */
export function parseAttributeValues(
  variant: PrintfulSyncVariantRaw,
  productName?: string,
): Record<string, string> {
  const out: Record<string, string> = {};

  const size = variant.product?.size?.trim();
  const color = variant.product?.color?.trim();
  if (color) out['Kleur'] = color;
  if (size) out['Maat'] = size;
  if (Object.keys(out).length > 0) return out;

  // Fallback: split the variant name. Printful names look like
  // "Unisex Hoodie - Black / L" or "Mug (11oz)".
  let raw = (variant.name ?? '').trim();
  if (productName && raw.toLowerCase().startsWith(productName.trim().toLowerCase())) {
    raw = raw.slice(productName.trim().length).replace(/^\s*[-–:·]\s*/, '').trim();
  }
  if (!raw) raw = (variant.name ?? '').trim();
  if (!raw) return { 'Variant': 'Standaard' };

  const parts = raw.split('/').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { 'Variant': raw };
  if (parts.length === 1) {
    return looksLikeSize(parts[0]) ? { 'Maat': parts[0] } : { 'Variant': parts[0] };
  }
  if (parts.length === 2) {
    const [a, b] = parts;
    if (looksLikeSize(b) && !looksLikeSize(a)) return { 'Kleur': a, 'Maat': b };
    if (looksLikeSize(a) && !looksLikeSize(b)) return { 'Maat': a, 'Kleur': b };
  }
  parts.forEach((p, i) => { out[`Optie ${i + 1}`] = p; });
  return out;
}

/** Variant title convention across SellQo: "waarde · waarde". */
export function buildVariantTitle(attrs: Record<string, string>): string {
  const values = Object.values(attrs).filter(Boolean);
  return values.length > 0 ? values.join(' · ') : 'Standaard';
}

/** Best available mockup URL for a sync variant. */
export function pickPreviewImage(variant: PrintfulSyncVariantRaw): string | undefined {
  const files = Array.isArray(variant.files) ? variant.files : [];
  const preview = files.find((f) => f?.type === 'preview' && (f.preview_url || f.url));
  if (preview) return preview.preview_url ?? preview.url ?? undefined;
  const anyPreview = files.find((f) => f?.preview_url)?.preview_url;
  if (anyPreview) return anyPreview;
  return variant.product?.image ?? undefined;
}

export function parseRetailPrice(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * LOVEKE-POD-2-FIX — the full image set for one sync product.
 * Root cause of the earlier behaviour: only files[type='preview'] was used, one
 * per variant, so the product effectively got the same thumbnail several times.
 * Here we take the product thumbnail first, then EVERY files[] entry across ALL
 * sync variants (all types: mockups, lifestyle, back prints), deduplicated on
 * URL with the incoming order preserved. Pure function: no network, no DB.
 */
export function collectProductImages(
  syncProduct: { thumbnail_url?: string | null } | null | undefined,
  syncVariants: PrintfulSyncVariantRaw[] | null | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (url: unknown) => {
    if (typeof url !== 'string') return;
    const u = url.trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };

  push(syncProduct?.thumbnail_url);

  for (const v of Array.isArray(syncVariants) ? syncVariants : []) {
    for (const f of Array.isArray(v?.files) ? v.files! : []) {
      push(f?.preview_url ?? f?.url);
    }
    push(v?.product?.image);
  }

  return out;
}
