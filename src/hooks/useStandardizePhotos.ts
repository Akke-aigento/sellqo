// PHOTO-STD-1 / EDITOR-2 (16-10-2026) — foto's in de fotostandaard zetten en vervangen.
//
// Per foto: ophalen → in de standaardvorm renderen (photoStandard.ts) → als nieuw bestand
// opladen → in de bibliotheek registreren → de URL vervangen in de producten die hem
// gebruiken (rij per rij vers gelezen) en in varianten waar hij de variantfoto is.
// Het origineel blijft in storage én in de bibliotheek staan: niets gaat verloren en je
// kunt altijd terug.

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { fetchImageBlob, renderStandardized, type PhotoStandardSettings } from '@/lib/photoStandard';
import { registerMediaAsset, type MediaClientLike } from '@/lib/mediaRegistry';
import { containsUrl, replaceInArray } from '@/lib/mediaLibrary';
import { untypedTable } from '@/lib/untypedTable';

interface ProductPhotoRow { id: string; images: string[] | null; featured_image: string | null }

export interface PhotoRef {
  url: string;
  /** Producten die deze foto gebruiken. */
  productIds: string[];
  title?: string;
}

export interface StandardizeResult {
  done: number;
  failed: { url: string; reason: string }[];
}

/** Uploadt een (bewerkt) beeld als nieuw bestand en zet het in de bibliotheek. */
export async function uploadProcessedImage(
  tenantId: string,
  blob: Blob,
  meta: { contentType: string; width: number; height: number; title?: string; prefix?: string },
): Promise<string> {
  const ext = meta.contentType === 'image/png' ? 'png' : 'jpg';
  const path = `${tenantId}/${meta.prefix || 'std'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, blob, { contentType: meta.contentType, cacheControl: '31536000', upsert: false });
  if (error) throw error;
  const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  await registerMediaAsset(supabase as unknown as MediaClientLike, {
    tenantId,
    url,
    folder: 'products',
    source: 'upload',
    title: meta.title ?? null,
    fileType: meta.contentType,
    fileSize: blob.size,
    width: meta.width,
    height: meta.height,
  });
  return url;
}

/** Vervangt `from` door `to` in de gegeven producten en in varianten met die variantfoto. */
export async function replacePhotoUrl(tenantId: string, productIds: string[], from: string, to: string): Promise<void> {
  if (productIds.length) {
    const { data, error } = await untypedTable<ProductPhotoRow>('products').select('id, images, featured_image').in('id', productIds);
    if (error) throw error;
    for (const p of data || []) {
      const update: Record<string, unknown> = {};
      if (containsUrl(p.images, from)) update.images = replaceInArray(p.images, from, to);
      if (p.featured_image === from) update.featured_image = to;
      if (Object.keys(update).length) {
        const { error: e } = await untypedTable('products').update(update).eq('id', p.id);
        if (e) throw e;
      }
    }
  }
  const { error: vErr } = await untypedTable('product_variants').update({ image_url: to }).eq('tenant_id', tenantId).eq('image_url', from);
  if (vErr) throw vErr;
  // Ook de fotolijst van varianten (16-10: ontbrak in de eerste versie).
  const { data: vars, error: vlErr } = await untypedTable<{ id: string; images: string[] | null }>('product_variants')
    .select('id, images').eq('tenant_id', tenantId).contains('images', [from]);
  if (vlErr) throw vlErr;
  for (const v of vars || []) {
    const { error: e } = await untypedTable('product_variants').update({ images: replaceInArray(v.images, from, to) }).eq('id', v.id);
    if (e) throw e;
  }
}

export function useStandardizePhotos() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const run = useCallback(async (refs: PhotoRef[], settings: PhotoStandardSettings): Promise<StandardizeResult> => {
    const tenantId = currentTenant?.id;
    if (!tenantId || refs.length === 0) return { done: 0, failed: [] };
    setRunning(true);
    setProgress({ done: 0, total: refs.length });
    const failed: StandardizeResult['failed'] = [];
    let done = 0;
    // Eén voor één: canvaswerk is zwaar en zo blijft de pagina bruikbaar.
    for (const ref of refs) {
      try {
        const source = await fetchImageBlob(ref.url);
        const out = await renderStandardized(source, settings);
        URL.revokeObjectURL(out.previewUrl);
        const newUrl = await uploadProcessedImage(tenantId, out.blob, {
          contentType: out.contentType, width: out.width, height: out.height, title: ref.title,
        });
        await replacePhotoUrl(tenantId, ref.productIds, ref.url, newUrl);
        done++;
      } catch (e) {
        failed.push({ url: ref.url, reason: e instanceof Error ? e.message : String(e) });
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setRunning(false);
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['media-assets'] });
    return { done, failed };
  }, [currentTenant?.id, queryClient]);

  return { run, running, progress };
}
