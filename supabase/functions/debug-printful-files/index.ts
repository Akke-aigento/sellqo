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

interface PfFile {
  type?: string;
  url?: string;
  preview_url?: string;
  filename?: string;
  mime_type?: string;
  status?: string;
}

interface PfSyncVariant {
  id?: number;
  name?: string;
  files?: PfFile[];
  options?: unknown[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tenantId, syncProductId } = await req.json() as {
      tenantId?: string; syncProductId?: number | string;
    };
    if (!tenantId) return json({ success: false, error: 'tenantId is verplicht' }, 400);
    if (!syncProductId) return json({ success: false, error: 'syncProductId is verplicht' }, 400);

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

    const res = await fetch(`https://api.printful.com/store/products/${syncProductId}`, { headers });
    if (!res.ok) {
      return json({
        success: false,
        error: res.status === 401 || res.status === 403
          ? 'Token is ongeldig of verlopen'
          : `Printful gaf een fout terug (status ${res.status})`,
      }, 400);
    }

    const body = await res.json().catch(() => null) as {
      result?: {
        sync_product?: { id?: number; name?: string; thumbnail_url?: string };
        sync_variants?: PfSyncVariant[];
      };
    } | null;

    const sp = body?.result?.sync_product ?? {};
    const variants = Array.isArray(body?.result?.sync_variants) ? body!.result!.sync_variants! : [];

    const allTypes = new Set<string>();
    let totalFiles = 0;
    let previewLike = 0;

    const variantDiag = variants.map((v) => {
      const files = Array.isArray(v?.files) ? v.files! : [];
      totalFiles += files.length;
      const fileDiag = files.map((f) => {
        const type = f?.type ?? 'unknown';
        allTypes.add(type);
        const hasPreview = !!f?.preview_url;
        if (hasPreview || type === 'preview' || type === 'mockup') previewLike++;
        return {
          type,
          has_preview_url: hasPreview,
          has_url: !!f?.url,
          filename: f?.filename ?? null,
          mime_type: f?.mime_type ?? null,
          status: f?.status ?? null,
        };
      });
      return {
        sync_variant_id: v?.id ?? null,
        variant_name: v?.name ?? null,
        files: fileDiag,
        options_count: Array.isArray(v?.options) ? v.options!.length : 0,
      };
    });

    console.log('[debug-printful-files] diagnose', {
      sync_product_id: sp?.id ?? null,
      variants: variantDiag.length,
      total_files_across_variants: totalFiles,
      unique_preview_like_count: previewLike,
      all_file_types_seen: Array.from(allTypes),
    });

    return json({
      success: true,
      sync_product: {
        id: sp?.id ?? null,
        name: sp?.name ?? null,
        thumbnail_url_present: !!sp?.thumbnail_url,
      },
      all_file_types_seen: Array.from(allTypes),
      total_files_across_variants: totalFiles,
      unique_preview_like_count: previewLike,
      variants: variantDiag,
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const msg = (err as Error)?.message ?? JSON.stringify(err);
    console.error('[debug-printful-files] error:', msg);
    return json({ success: false, error: msg }, 500);
  }
});