// LOVEKE-POD-2 — Preview of a Printful → SellQo product import.
// Read-only by design: this function never writes a single row. The user
// confirms (and may adjust prices) before apply-printful-import runs.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from '../_shared/auth.ts';
import { decryptPrintfulToken } from '../_shared/printfulCrypto.ts';
import {
  parseAttributeValues, buildVariantTitle, pickPreviewImage, parseRetailPrice,
  collectProductImages, type PrintfulSyncVariantRaw,
} from '../_shared/printfulImport.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tenantId, syncProductIds } = await req.json() as {
      tenantId?: string; syncProductIds?: number[];
    };
    if (!tenantId) return json({ success: false, error: 'tenantId is verplicht' }, 400);

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ['tenant_admin']);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: cred, error: credErr } = await admin
      .from('tenant_printful_credentials')
      .select('token_ciphertext, store_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (credErr) throw new Error(credErr.message);
    if (!cred) return json({ success: false, error: 'Geen Printful-verbinding geconfigureerd' }, 400);

    let token: string;
    try {
      token = await decryptPrintfulToken(cred.token_ciphertext);
    } catch {
      return json({ success: false, error: 'Opgeslagen token kon niet worden ontsleuteld' }, 400);
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (cred.store_id) headers['X-PF-Store-Id'] = cred.store_id;

    // 1. Which sync products?
    let ids: number[] = Array.isArray(syncProductIds)
      ? syncProductIds.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : [];
    if (ids.length === 0) {
      const listRes = await fetch('https://api.printful.com/store/products?limit=50', { headers });
      if (!listRes.ok) {
        return json({
          success: false,
          error: listRes.status === 401 || listRes.status === 403
            ? 'Token is ongeldig of verlopen'
            : `Printful gaf een fout terug (status ${listRes.status})`,
        }, 400);
      }
      const listBody = await listRes.json().catch(() => null) as
        | { result?: Array<{ id?: number }> } | null;
      ids = (listBody?.result ?? []).map((p) => Number(p?.id)).filter((n) => Number.isFinite(n)).slice(0, 50);
    }

    // 2. Existing imports for the duplicate badge.
    const externalIds = ids.map((id) => `@${id}`);
    const { data: existing } = await admin
      .from('products')
      .select('id, external_id')
      .eq('tenant_id', tenantId)
      .eq('import_source', 'printful')
      .in('external_id', externalIds);
    const importedSet = new Set((existing ?? []).map((r) => r.external_id as string));

    const { data: mappings } = await admin
      .from('printful_variant_mappings')
      .select('printful_sync_variant_id')
      .eq('tenant_id', tenantId);
    const mappedVariants = new Set((mappings ?? []).map((m) => Number(m.printful_sync_variant_id)));

    const products: unknown[] = [];

    // Sequential on purpose: Printful rate-limits at 120 req/min.
    for (const id of ids) {
      const detRes = await fetch(`https://api.printful.com/store/products/${id}`, { headers });
      if (!detRes.ok) continue;
      const det = await detRes.json().catch(() => null) as | {
        result?: {
          sync_product?: { id?: number; name?: string; thumbnail_url?: string };
          sync_variants?: PrintfulSyncVariantRaw[];
        };
      } | null;
      const sp = det?.result?.sync_product;
      if (!sp?.id) continue;
      const productName = sp.name ?? `Product ${sp.id}`;
      const rawVariants = Array.isArray(det?.result?.sync_variants) ? det!.result!.sync_variants! : [];

      const skus = rawVariants.map((v) => v.sku).filter((s): s is string => !!s);
      let skuMatches = new Set<string>();
      if (skus.length > 0) {
        const { data: vRows } = await admin
          .from('product_variants')
          .select('sku')
          .eq('tenant_id', tenantId)
          .in('sku', skus);
        skuMatches = new Set((vRows ?? []).map((r) => r.sku as string));
      }

      const variants = rawVariants.filter((v) => !!v?.id).map((v) => {
        const attrs = parseAttributeValues(v, productName);
        return {
          sync_variant_id: Number(v.id),
          name: v.name ?? `Variant ${v.id}`,
          title: buildVariantTitle(attrs),
          sku: v.sku ?? null,
          retail_price: parseRetailPrice(v.retail_price),
          attribute_values: attrs,
          preview_image_url: pickPreviewImage(v) ?? null,
          already_mapped: mappedVariants.has(Number(v.id)),
          sku_in_use: v.sku ? skuMatches.has(v.sku) : false,
        };
      });

      products.push({
        sync_product_id: Number(sp.id),
        name: productName,
        thumbnail_url: sp.thumbnail_url ?? null,
        duplicate: importedSet.has(`@${sp.id}`),
        image_count: collectProductImages(sp, rawVariants).length,
        variants,
      });
    }

    return json({ success: true, products });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    console.error('[preview-printful-import] error:', errMsg(err));
    return json({ success: false, error: errMsg(err) }, 500);
  }
});
