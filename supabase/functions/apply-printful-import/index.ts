// LOVEKE-POD-2 — Apply a (user-confirmed) Printful → SellQo product import.
// Strictly additive: creates new products + variants + variant mappings only.
// Never touches existing products or any marketplace sync column.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from '../_shared/auth.ts';
import { decryptPrintfulToken } from '../_shared/printfulCrypto.ts';
import { collectProductImages, type PrintfulSyncVariantRaw } from '../_shared/printfulImport.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const errMsg = (err: unknown) => (err as Error)?.message ?? JSON.stringify(err);

const BUCKET = 'product-images';

interface InVariant {
  sync_variant_id: number;
  title?: string;
  attribute_values?: Record<string, string>;
  sku?: string | null;
  price?: number | null;
  preview_image_url?: string | null;
}
interface InProduct {
  sync_product_id: number;
  name: string;
  price?: number | null;
  featured_source_url?: string | null;
  variants: InVariant[];
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'printful-product';
}

function extFromUrl(url: string, contentType: string | null): string {
  const clean = url.split('?')[0];
  const m = clean.match(/\.(png|jpe?g|webp|gif|avif)$/i);
  if (m) return m[1].toLowerCase();
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('webp')) return 'webp';
  return 'jpg';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as { tenantId?: string; products?: InProduct[]; reimport?: boolean };
    const tenantId = body.tenantId;
    const inProducts = Array.isArray(body.products) ? body.products : [];
    const reimport = body.reimport === true;
    if (!tenantId) return json({ success: false, error: 'tenantId is verplicht' }, 400);

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ['tenant_admin']);

    if (inProducts.length === 0) return json({ success: false, error: 'Geen producten meegegeven' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Printful headers, used to fetch the full image set per sync product.
    let pfHeaders: Record<string, string> | null = null;
    try {
      const { data: cred } = await admin
        .from('tenant_printful_credentials')
        .select('token_ciphertext, store_id')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (cred?.token_ciphertext) {
        const token = await decryptPrintfulToken(cred.token_ciphertext);
        pfHeaders = { Authorization: `Bearer ${token}` };
        if (cred.store_id) pfHeaders['X-PF-Store-Id'] = cred.store_id;
      }
    } catch (err) {
      console.warn('[apply-printful-import] printful credentials unavailable:', errMsg(err));
    }

    // All unique image URLs for one sync product (thumbnail first, then every
    // files[] entry across all variants). Falls back to the client-supplied
    // URLs when Printful cannot be reached.
    async function sourceImageUrls(syncProductId: number, p: InProduct): Promise<string[]> {
      if (pfHeaders) {
        try {
          const res = await fetch(`https://api.printful.com/store/products/${syncProductId}`, { headers: pfHeaders });
          if (res.ok) {
            const det = await res.json().catch(() => null) as | {
              result?: {
                sync_product?: { thumbnail_url?: string };
                sync_variants?: PrintfulSyncVariantRaw[];
              };
            } | null;
            const urls = collectProductImages(det?.result?.sync_product, det?.result?.sync_variants);
            if (urls.length > 0) return urls;
          } else {
            console.warn(`[apply-printful-import] product detail failed (${res.status})`);
          }
        } catch (err) {
          console.warn('[apply-printful-import] product detail error:', errMsg(err));
        }
      }
      const fallback = [p.featured_source_url, ...(p.variants ?? []).map((v) => v.preview_image_url)]
        .filter((u): u is string => typeof u === 'string' && u.length > 0);
      return Array.from(new Set(fallback));
    }

    // Server-side download + upload. Returns the public bucket URL, never the
    // Printful CDN URL: imported images must stay available if Printful rotates
    // its CDN or the design is removed there.
    async function storeImage(url: string, syncProductId: number, nameHint: string, index = 0): Promise<string | null> {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`[apply-printful-import] image download failed (${res.status})`);
          return null;
        }
        const contentType = res.headers.get('content-type');
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.byteLength === 0) return null;
        const ext = extFromUrl(url, contentType);
        const path = `${tenantId}/printful/${syncProductId}/${index}-${slugify(nameHint)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
        const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
          contentType: contentType && contentType.startsWith('image/') ? contentType : `image/${ext}`,
          upsert: true,
        });
        if (upErr) {
          console.warn('[apply-printful-import] image upload failed:', upErr.message);
          return null;
        }
        return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      } catch (err) {
        console.warn('[apply-printful-import] image error:', errMsg(err));
        return null;
      }
    }

    async function uniqueSlug(base: string): Promise<string> {
      let candidate = base;
      for (let i = 1; i <= 25; i++) {
        const { data } = await admin
          .from('products')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('slug', candidate)
          .maybeSingle();
        if (!data) return candidate;
        candidate = `${base}-${i + 1}`;
      }
      return `${base}-${crypto.randomUUID().slice(0, 6)}`;
    }

    const results: Array<Record<string, unknown>> = [];

    for (const p of inProducts) {
      const syncProductId = Number(p?.sync_product_id);
      if (!Number.isFinite(syncProductId)) continue;
      const externalId = `@${syncProductId}`;

      try {
        // 1. Duplicate guard — idempotent on external_id.
        const { data: dup, error: dupErr } = await admin
          .from('products')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('external_id', externalId)
          .eq('import_source', 'printful')
          .maybeSingle();
        if (dupErr) throw new Error(dupErr.message);
        if (dup && !reimport) {
          results.push({ sync_product_id: syncProductId, status: 'skipped_duplicate', product_id: dup.id });
          continue;
        }

        const name = (p.name ?? `Printful product ${syncProductId}`).trim();
        const variants = Array.isArray(p.variants) ? p.variants.filter((v) => Number.isFinite(Number(v?.sync_variant_id))) : [];

        // 2. Full image set to our own bucket (never a Printful CDN URL in the DB).
        const sourceUrls = await sourceImageUrls(syncProductId, p);
        const stored: string[] = [];
        for (let i = 0; i < sourceUrls.length; i++) {
          const up = await storeImage(sourceUrls[i], syncProductId, name, i);
          if (up) stored.push(up);
        }
        const images = Array.from(new Set(stored));
        const featured = images[0] ?? null;

        // Existing product + explicit reimport: only refresh images/featured_image.
        // Name, price, activation flags and every sync column stay untouched — the
        // tenant may have adjusted those already.
        if (dup) {
          const { error: updErr } = await admin
            .from('products')
            .update({ images, featured_image: featured })
            .eq('id', dup.id)
            .eq('tenant_id', tenantId);
          if (updErr) throw new Error(updErr.message);
          results.push({
            sync_product_id: syncProductId,
            status: 'reimported_images',
            product_id: dup.id,
            image_count: images.length,
          });
          continue;
        }

        const variantImages = new Map<number, string | null>();
        for (const [vi, v] of variants.entries()) {
          const src = v.preview_image_url;
          variantImages.set(
            Number(v.sync_variant_id),
            src ? await storeImage(src, syncProductId, `${name}-${v.title ?? v.sync_variant_id}`, 1000 + vi) : null,
          );
        }

        // Price: explicit product price, else the cheapest variant suggestion.
        const variantPrices = variants
          .map((v) => (typeof v.price === 'number' && Number.isFinite(v.price) ? v.price : null))
          .filter((n): n is number => n !== null);
        const price = typeof p.price === 'number' && Number.isFinite(p.price)
          ? p.price
          : (variantPrices.length > 0 ? Math.min(...variantPrices) : 0);

        const slug = await uniqueSlug(slugify(name));

        // 3. One products row. Additive columns only — no marketplace sync columns.
        const { data: product, error: prodErr } = await admin
          .from('products')
          .insert({
            tenant_id: tenantId,
            name,
            slug,
            price,
            import_source: 'printful',
            external_id: externalId,
            raw_import_data: p as unknown as Record<string, unknown>,
            imported_at: new Date().toISOString(),
            featured_image: featured ?? images[0] ?? null,
            images,
            is_active: false,
            hide_from_storefront: true,
            track_inventory: false,
          })
          .select('id')
          .single();
        if (prodErr) throw new Error(prodErr.message);
        const productId = product.id as string;

        // 4. One product_variants row per sync variant.
        let variantCount = 0;
        for (let i = 0; i < variants.length; i++) {
          const v = variants[i];
          const syncVariantId = Number(v.sync_variant_id);
          const attrs = (v.attribute_values && typeof v.attribute_values === 'object')
            ? v.attribute_values
            : { Variant: 'Standaard' };
          const title = (v.title ?? Object.values(attrs).join(' · ')) || 'Standaard';
          const image = variantImages.get(syncVariantId) ?? null;

          const { data: variantRow, error: varErr } = await admin
            .from('product_variants')
            .insert({
              product_id: productId,
              tenant_id: tenantId,
              title,
              attribute_values: attrs,
              sku: v.sku ?? null,
              price: typeof v.price === 'number' && Number.isFinite(v.price) ? v.price : null,
              image_url: image,
              images: image ? [image] : [],
              is_active: true,
              track_inventory: false,
              position: i,
            })
            .select('id')
            .single();
          if (varErr) {
            console.warn(`[apply-printful-import] variant insert failed (${syncVariantId}):`, varErr.message);
            continue;
          }
          variantCount++;

          // 5. Automatic mapping so forwarding works without manual linking.
          const { error: mapErr } = await admin
            .from('printful_variant_mappings')
            .upsert({
              tenant_id: tenantId,
              variant_id: variantRow.id as string,
              printful_sync_variant_id: syncVariantId,
              printful_sync_product_id: syncProductId,
              printful_variant_name: `${name} · ${title}`,
              is_active: true,
            }, { onConflict: 'tenant_id,variant_id' });
          if (mapErr) console.warn('[apply-printful-import] mapping upsert failed:', mapErr.message);
        }

        results.push({ sync_product_id: syncProductId, status: 'imported', product_id: productId, variant_count: variantCount });
      } catch (err) {
        console.error(`[apply-printful-import] product ${syncProductId} failed:`, errMsg(err));
        results.push({ sync_product_id: syncProductId, status: 'failed', error: errMsg(err) });
      }
    }

    return json({
      success: true,
      results,
      imported: results.filter((r) => r.status === 'imported').length,
      skipped: results.filter((r) => r.status === 'skipped_duplicate').length,
      reimported: results.filter((r) => r.status === 'reimported_images').length,
      failed: results.filter((r) => r.status === 'failed').length,
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    console.error('[apply-printful-import] error:', errMsg(err));
    return json({ success: false, error: errMsg(err) }, 500);
  }
});
