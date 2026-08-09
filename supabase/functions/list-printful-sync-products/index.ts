import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from '../_shared/auth.ts';
import { decryptPrintfulToken } from '../_shared/printfulCrypto.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tenantId } = await req.json() as { tenantId?: string };
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
      | { result?: Array<{ id?: number; name?: string; thumbnail_url?: string }> } | null;
    const products = Array.isArray(listBody?.result) ? listBody!.result!.slice(0, 50) : [];

    const out: Array<{
      sync_product_id: number; name: string; thumbnail?: string;
      variants: Array<{ sync_variant_id: number; name: string; sku?: string }>;
    }> = [];

    // Sequential on purpose: Printful rate-limits at 120 req/min.
    for (const p of products) {
      if (!p?.id) continue;
      const detRes = await fetch(`https://api.printful.com/store/products/${p.id}`, { headers });
      if (!detRes.ok) continue;
      const det = await detRes.json().catch(() => null) as
        | { result?: { sync_variants?: Array<{ id?: number; name?: string; sku?: string }> } } | null;
      const variants = (det?.result?.sync_variants ?? [])
        .filter((v) => !!v?.id)
        .map((v) => ({ sync_variant_id: Number(v.id), name: v.name ?? `Variant ${v.id}`, sku: v.sku ?? undefined }));
      out.push({
        sync_product_id: Number(p.id),
        name: p.name ?? `Product ${p.id}`,
        thumbnail: p.thumbnail_url ?? undefined,
        variants,
      });
    }

    return json({ success: true, products: out });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const msg = (err as Error)?.message ?? JSON.stringify(err);
    console.error('[list-printful-sync-products] error:', msg);
    return json({ success: false, error: msg }, 500);
  }
});
