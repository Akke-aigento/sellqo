import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from '../_shared/auth.ts';
import { decryptPrintfulToken } from '../_shared/printfulCrypto.ts';
import { testPrintfulToken } from '../_shared/printfulApi.ts';

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
    const { tenantId, token, storeId } = await req.json() as {
      tenantId?: string; token?: string; storeId?: string;
    };
    if (!tenantId) return json({ success: false, error: 'tenantId is verplicht' }, 400);

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ['tenant_admin']);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Pre-save mode: test the supplied token. Otherwise use stored credentials.
    if (token) {
      const result = await testPrintfulToken(token, storeId ?? null);
      return json({ success: true, ok: result.ok, error: result.error ?? null, store_name: result.storeName ?? null });
    }

    const { data: cred, error: credErr } = await admin
      .from('tenant_printful_credentials')
      .select('token_ciphertext, store_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (credErr) throw new Error(credErr.message);
    if (!cred) return json({ success: true, ok: false, error: 'Geen Printful-verbinding geconfigureerd' });

    let plain: string;
    try {
      plain = await decryptPrintfulToken(cred.token_ciphertext);
    } catch {
      return json({ success: true, ok: false, error: 'Opgeslagen token kon niet worden ontsleuteld' });
    }

    const result = await testPrintfulToken(plain, storeId ?? cred.store_id);

    await admin
      .from('tenant_printful_credentials')
      .update({
        last_test_at: new Date().toISOString(),
        last_test_ok: result.ok,
        ...(result.ok && result.storeName ? { connected_store_name: result.storeName } : {}),
      })
      .eq('tenant_id', tenantId);

    return json({ success: true, ok: result.ok, error: result.error ?? null, store_name: result.storeName ?? null });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const msg = (err as Error)?.message ?? JSON.stringify(err);
    console.error('[test-printful-connection] error:', msg);
    return json({ success: false, error: msg }, 500);
  }
});