// EDITOR-MEDIA-1 (16-10-2026) — de mediabibliotheek van de beeldkiezer in "Aanpassen".
//
// Toont beelden die de winkel al eerder uploadde, zodat je ze opnieuw kunt kiezen in
// plaats van ze opnieuw te uploaden. Bron is storage zelf (geen aparte tabel): de mappen
// waar de admin vandaag beelden van de winkel neerzet.
//
//   tenant-assets/<tenant>/storefront   uploads uit de beeldkiezer zelf (VisualMediaPicker)
//   tenant-assets/<tenant>              logo uit de onboarding (LogoUploadStep)
//   product-images/<tenant>             productfoto's (ProductForm), categorieën, events,
//                                       cadeaubonnen (useImageUpload: <tenant>/<ts>-<rnd>.<ext>)
//   marketing-assets/<tenant>           de bestaande Mediabibliotheek (marketing) en de
//                                       productfotobibliotheek (MediaLibraryPickerDialog)
//
// Alleen het eerste niveau van elke map: storage.list() is niet recursief, en submappen
// (bv. product-images/<tenant>/printful) zijn geen eigen uploads.
//
// Niet opgenomen: tenant-logos (logo/favicon uit Branding — eigen plek in de editor),
// ai-images (eigen bibliotheek), documentbuckets (geen beelden).
//
// Afscherming: de UI vraagt enkel mappen onder het eigen tenant-id op, en sinds
// SEC-STORAGE-1 (16-10-2026) dwingt RLS dat in alle drie de buckets ook af: listen kan
// alleen in de eigen tenantmap (of als platform-admin). Publieke beeld-URL's werken
// los van RLS, want de buckets zijn public.

export type MediaBucket = 'tenant-assets' | 'product-images' | 'marketing-assets';

export interface MediaSource {
  bucket: MediaBucket;
  prefix: string;
}

/** Eén rij uit supabase.storage.from(b).list(). Mappen hebben id === null. */
export interface StorageListEntry {
  name: string;
  id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: { mimetype?: string; size?: number } | null;
}

export interface MediaItem {
  /** bucket/pad — uniek */
  key: string;
  bucket: MediaBucket;
  path: string;
  name: string;
  url: string;
  createdAt: string;
  size?: number;
}

const TENANT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

/** De mappen van één winkel. Geen geldig tenant-id = niets (nooit de bucketwortel listen). */
export function mediaLibrarySources(tenantId: string | null | undefined): MediaSource[] {
  if (!tenantId || !TENANT_ID.test(tenantId)) return [];
  return [
    { bucket: 'tenant-assets', prefix: `${tenantId}/storefront` },
    { bucket: 'tenant-assets', prefix: tenantId },
    { bucket: 'product-images', prefix: tenantId },
    { bucket: 'marketing-assets', prefix: tenantId },
  ];
}

export function isImageEntry(e: StorageListEntry): boolean {
  if (!e || e.id === null || !e.name || e.name.startsWith('.')) return false;
  const mime = e.metadata?.mimetype || '';
  if (mime) return mime.startsWith('image/');
  return IMAGE_EXT.test(e.name);
}

export function toMediaItems(
  entries: StorageListEntry[],
  source: MediaSource,
  publicUrl: (bucket: MediaBucket, path: string) => string,
): MediaItem[] {
  return entries.filter(isImageEntry).map((e) => {
    const path = `${source.prefix}/${e.name}`;
    return {
      key: `${source.bucket}/${path}`,
      bucket: source.bucket,
      path,
      name: e.name,
      url: publicUrl(source.bucket, path),
      createdAt: e.created_at || e.updated_at || '',
      size: e.metadata?.size,
    };
  });
}

/** Nieuwste eerst; zonder datum achteraan; bij gelijke datum op naam. */
export function sortNewestFirst(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });
}

const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Zoeken op bestandsnaam: hoofdletter- en accentongevoelig, alle woorden moeten voorkomen. */
export function filterByName(items: MediaItem[], query: string): MediaItem[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter((i) => {
    const n = fold(i.name);
    return words.every((w) => n.includes(w));
  });
}

/** Lijsten samenvoegen, dubbels (zelfde bucket + pad) eruit, nieuwste eerst. */
export function mergeLibrary(lists: MediaItem[][]): MediaItem[] {
  const seen = new Map<string, MediaItem>();
  for (const list of lists) for (const i of list) if (!seen.has(i.key)) seen.set(i.key, i);
  return sortNewestFirst([...seen.values()]);
}

// Minimale vorm van de supabase-client die we nodig hebben (testbaar zonder echte client).
export interface StorageLike {
  storage: {
    from: (bucket: string) => {
      list: (
        path: string,
        opts: { limit: number; offset: number; sortBy: { column: string; order: 'asc' | 'desc' } },
      ) => PromiseLike<{ data: StorageListEntry[] | null; error: { message: string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
}

export const LIST_PAGE = 1000;
const MAX_PAGES = 10;

export interface MediaLibraryResult {
  items: MediaItem[];
  /** Mappen die niet gelezen konden worden — nooit stil weggeslikt. */
  failed: string[];
}

export async function fetchMediaLibrary(client: StorageLike, tenantId: string | null | undefined): Promise<MediaLibraryResult> {
  const sources = mediaLibrarySources(tenantId);
  const failed: string[] = [];
  const lists = await Promise.all(sources.map(async (src) => {
    const bucket = client.storage.from(src.bucket);
    const out: StorageListEntry[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await bucket.list(src.prefix, {
        limit: LIST_PAGE,
        offset: page * LIST_PAGE,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) { failed.push(`${src.bucket}/${src.prefix}`); return []; }
      out.push(...(data || []));
      if (!data || data.length < LIST_PAGE) break;
    }
    return toMediaItems(out, src, (b, p) => client.storage.from(b).getPublicUrl(p).data.publicUrl);
  }));
  return { items: mergeLibrary(lists), failed };
}
