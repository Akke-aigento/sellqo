// MEDIA-1 (16-10-2026) — gedeelde helpers voor de mediabibliotheek.
//
// media_assets is de ene bron van alle beelden van een winkel. Uploads registreren zich
// hier zelf (useImageUpload), en DB-triggers registreren elke foto die op een product,
// variant of categorie belandt (migratie 20261016190000_media_1_one_library.sql).
//
// Dit bestand bevat alleen pure functies plus twee kleine browserhelpers (afmetingen
// meten), zodat de logica zonder echte client te testen is.

/** Een URL in onze eigen Supabase-storage (publieke bucket). */
export function isOwnStorageUrl(url: string | null | undefined): boolean {
  return !!url && /\/storage\/v1\/object\/public\//.test(url);
}

/** Een beeld op een vreemde server (bv. de Shopify-CDN na een import). */
export function isExternalImageUrl(url: string | null | undefined): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  return !isOwnStorageUrl(url);
}

/** Hostnaam voor weergave ("cdn.shopify.com"); leeg bij een ongeldige URL. */
export function urlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

/** Laatste padsegment zonder querystring, zoals de DB-functie media_file_name_from_url. */
export function fileNameFromUrl(url: string): string {
  const clean = url.split('#')[0].split('?')[0];
  const last = clean.substring(clean.lastIndexOf('/') + 1);
  return last || 'afbeelding';
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

/** Extensie voor een opgehaald beeld: eerst het content-type, dan de URL, anders jpg. */
export function extensionFor(contentType: string | null | undefined, url: string): string {
  const fromType = contentType ? MIME_EXT[contentType.split(';')[0].trim().toLowerCase()] : undefined;
  if (fromType) return fromType;
  const m = fileNameFromUrl(url).match(/\.([a-z0-9]{2,5})$/i);
  const ext = m?.[1]?.toLowerCase();
  if (ext && Object.values(MIME_EXT).includes(ext === 'jpeg' ? 'jpg' : ext)) return ext === 'jpeg' ? 'jpg' : ext;
  return 'jpg';
}

/** Vervangt elke voorkomen van `from` door `to`; null blijft null. */
export function replaceInArray(list: string[] | null | undefined, from: string, to: string): string[] | null {
  if (!list) return list ?? null;
  return list.map((u) => (u === from ? to : u));
}

/** Of een lijst `from` bevat (veilig voor null). */
export function containsUrl(list: string[] | null | undefined, url: string): boolean {
  return !!list && list.includes(url);
}

export interface ProductImageRef {
  id: string;
  name: string;
  images?: string[] | null;
  featured_image?: string | null;
}

/**
 * Welke producten een URL gebruiken: url → productnamen (en id's).
 * Gebruikt om "in gebruik bij …" te tonen en verwijderen te blokkeren.
 */
export function buildUsageMap(products: ProductImageRef[]): Map<string, { id: string; name: string }[]> {
  const map = new Map<string, { id: string; name: string }[]>();
  for (const p of products) {
    const urls = new Set<string>([...(p.images || []), ...(p.featured_image ? [p.featured_image] : [])]);
    for (const u of urls) {
      if (!u) continue;
      const list = map.get(u) || [];
      list.push({ id: p.id, name: p.name });
      map.set(u, list);
    }
  }
  return map;
}

export interface ImageSize {
  width: number;
  height: number;
}

/** Afmetingen van een lokaal bestand, zonder het te uploaden. null als de browser het niet kan lezen. */
export async function measureFile(file: Blob): Promise<ImageSize | null> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(file);
      const size = { width: bmp.width, height: bmp.height };
      bmp.close?.();
      return size.width > 0 && size.height > 0 ? size : null;
    }
  } catch {
    // HEIC en sommige formaten kan de browser niet decoderen; dan meten we later via <img>.
  }
  return null;
}
