// MEDIA-1 (16-10-2026) — externe foto's (bv. de Shopify-CDN na een import) naar eigen opslag.
//
// Waarom: zegt een winkel zijn oude Shopify-abonnement op, dan verdwijnen die URL's en
// staan er lege vakken in de webshop. Live op 16-10: 217 Shopify-foto's bij 2 winkels.
//
// Hoe: alles gebeurt in de browser van de beheerder (cdn.shopify.com stuurt
// Access-Control-Allow-Origin: *, gemeten 16-10). Per unieke URL: ophalen, opladen naar
// product-images/<tenant>/imported/, en daarna de URL vervangen in products.images,
// products.featured_image, product_variants.images/image_url, categories.image_url en de
// media_assets-rij. Elke rij wordt vers gelezen vlak voor het schrijven, zodat we geen
// gelijktijdige wijziging overschrijven. Lukt het ophalen niet, dan blijft alles van die
// URL ongemoeid en staat hij in de foutenlijst.

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { containsUrl, extensionFor, isExternalImageUrl, measureFile, replaceInArray, urlHost } from '@/lib/mediaLibrary';
import { untypedTable } from '@/lib/untypedTable';

export interface ExternalImageScan {
  urls: string[];
  hosts: string[];
}

export interface ExternalImportResult {
  moved: number;
  failed: { url: string; reason: string }[];
}

const PAGE = 1000;
const CONCURRENCY = 3;

// Rijvormen van wat we lezen; zo blijft alles getypeerd zonder de volledige tabeltypes.
interface ImageRow {
  id: string;
  images?: string[] | null;
  featured_image?: string | null;
  image_url?: string | null;
}

async function fetchAll(table: string, cols: string, tenantId: string): Promise<ImageRow[]> {
  const out: ImageRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await untypedTable<ImageRow>(table).select(cols).eq('tenant_id', tenantId).range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

interface UrlRefs {
  products: Set<string>;
  variants: Set<string>;
  categories: Set<string>;
}

/** Leest alle beeldkolommen van een winkel en indexeert per externe URL welke rijen hem gebruiken. */
async function indexExternalImages(tenantId: string): Promise<Map<string, UrlRefs>> {
  const [products, variants, categories] = await Promise.all([
    fetchAll('products', 'id, images, featured_image', tenantId),
    fetchAll('product_variants', 'id, images, image_url', tenantId),
    fetchAll('categories', 'id, image_url', tenantId),
  ]);
  const index = new Map<string, UrlRefs>();
  const add = (url: string | null | undefined, kind: keyof UrlRefs, id: string) => {
    if (!isExternalImageUrl(url)) return;
    const refs = index.get(url!) || { products: new Set(), variants: new Set(), categories: new Set() };
    refs[kind].add(id);
    index.set(url!, refs);
  };
  for (const p of products) {
    for (const u of p.images || []) add(u, 'products', p.id);
    add(p.featured_image, 'products', p.id);
  }
  for (const v of variants) {
    for (const u of v.images || []) add(u, 'variants', v.id);
    add(v.image_url, 'variants', v.id);
  }
  for (const c of categories) add(c.image_url, 'categories', c.id);
  return index;
}

/** Alle externe beeld-URL's van een winkel (producten, varianten, categorieën). */
export async function scanExternalImages(tenantId: string): Promise<ExternalImageScan> {
  const index = await indexExternalImages(tenantId);
  const urls = [...index.keys()].sort();
  const hosts = [...new Set(urls.map(urlHost).filter(Boolean))].sort();
  return { urls, hosts };
}

async function moveOne(tenantId: string, url: string, refs: UrlRefs): Promise<void> {
  // 1. Ophalen
  const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const contentType = (res.headers.get('content-type') || blob.type || 'image/jpeg').split(';')[0].trim();
  if (!contentType.startsWith('image/')) throw new Error(`geen afbeelding (${contentType})`);

  // 2. Opladen naar eigen opslag
  const ext = extensionFor(contentType, url);
  const path = `${tenantId}/imported/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('product-images')
    .upload(path, blob, { contentType, cacheControl: '31536000', upsert: false });
  if (upErr) throw upErr;
  const newUrl = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;

  // 3. Bibliotheekrij eerst omzetten, zodat de product-trigger geen tweede rij maakt.
  const size = await measureFile(blob);
  await untypedTable('media_assets')
    .update({ file_url: newUrl, file_type: contentType, file_size: blob.size, ...(size ? { width: size.width, height: size.height } : {}) })
    .eq('tenant_id', tenantId)
    .eq('file_url', url);

  // 4. Overal vervangen; elke rij vers gelezen vlak voor het schrijven.
  if (refs.products.size) {
    const { data, error } = await untypedTable<ImageRow>('products').select('id, images, featured_image').in('id', [...refs.products]);
    if (error) throw error;
    for (const p of data || []) {
      const update: Record<string, unknown> = {};
      if (containsUrl(p.images, url)) update.images = replaceInArray(p.images, url, newUrl);
      if (p.featured_image === url) update.featured_image = newUrl;
      if (Object.keys(update).length) {
        const { error: e } = await untypedTable('products').update(update).eq('id', p.id);
        if (e) throw e;
      }
    }
  }
  if (refs.variants.size) {
    const { data, error } = await untypedTable<ImageRow>('product_variants').select('id, images, image_url').in('id', [...refs.variants]);
    if (error) throw error;
    for (const v of data || []) {
      const update: Record<string, unknown> = {};
      if (containsUrl(v.images, url)) update.images = replaceInArray(v.images, url, newUrl);
      if (v.image_url === url) update.image_url = newUrl;
      if (Object.keys(update).length) {
        const { error: e } = await untypedTable('product_variants').update(update).eq('id', v.id);
        if (e) throw e;
      }
    }
  }
  if (refs.categories.size) {
    const { data, error } = await untypedTable<ImageRow>('categories').select('id, image_url').in('id', [...refs.categories]);
    if (error) throw error;
    for (const c of data || []) {
      if (c.image_url !== url) continue;
      const { error: e } = await untypedTable('categories').update({ image_url: newUrl }).eq('id', c.id);
      if (e) throw e;
    }
  }
}

export function useExternalImageImport() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const scan = useCallback(async () => {
    if (!currentTenant?.id) return { urls: [], hosts: [] } as ExternalImageScan;
    return scanExternalImages(currentTenant.id);
  }, [currentTenant?.id]);

  const run = useCallback(async (urls: string[]): Promise<ExternalImportResult> => {
    const tenantId = currentTenant?.id;
    if (!tenantId || urls.length === 0) return { moved: 0, failed: [] };
    setRunning(true);
    setProgress({ done: 0, total: 0 });
    const failed: ExternalImportResult['failed'] = [];
    let moved = 0;
    const index = await indexExternalImages(tenantId);
    const queue = urls.filter((u) => index.has(u));
    setProgress({ done: 0, total: queue.length });
    const worker = async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        try {
          await moveOne(tenantId, url, index.get(url)!);
          moved++;
        } catch (e) {
          failed.push({ url, reason: e instanceof Error ? e.message : String(e) });
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
    setRunning(false);
    queryClient.invalidateQueries({ queryKey: ['media-assets'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    return { moved, failed };
  }, [currentTenant?.id, queryClient]);

  return { scan, run, running, progress };
}
