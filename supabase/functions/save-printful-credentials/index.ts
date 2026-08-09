import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from '../_shared/auth.ts';
import { encryptPrintfulToken } from '../_shared/printfulCrypto.ts';
import { testPrintfulToken, sha256Hex } from '../_shared/printfulApi.ts';

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

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tenantId, token, storeId } = await req.json() as {
      tenantId?: string; token?: string; storeId?: string;
    };
    if (!tenantId) return json({ success: false, error: 'tenantId is verplicht' }, 400);
    if (!token || token.trim().length < 10) return json({ success: false, error: 'Printful private token is verplicht' }, 400);

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ['tenant_admin']);

    // Never persist an unvalidated token.
    const test = await testPrintfulToken(token, storeId ?? null);
    if (!test.ok) return json({ success: false, error: test.error ?? 'Verbinding mislukt' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const ciphertext = await encryptPrintfulToken(token.trim());

    // Per-tenant webhook secret (POD-1c): only the SHA-256 hash is stored.
    const { data: existing } = await admin
      .from('tenant_printful_credentials')
      .select('webhook_secret_hash')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    let webhookSecret: string | null = null;
    let webhookSecretHash: string | null = existing?.webhook_secret_hash ?? null;
    if (!webhookSecretHash) {
      webhookSecret = b64(crypto.getRandomValues(new Uint8Array(32)));
      webhookSecretHash = await sha256Hex(webhookSecret);
    }

    const { error: upsertErr } = await admin
      .from('tenant_printful_credentials')
      .upsert({
        tenant_id: tenantId,
        token_ciphertext: ciphertext,
        store_id: storeId?.trim() || null,
        webhook_secret_hash: webhookSecretHash,
        connected_store_name: test.storeName ?? null,
        last_test_at: new Date().toISOString(),
        last_test_ok: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' });
    if (upsertErr) throw new Error(upsertErr.message);

    // Seed the settings row with defaults if it does not exist yet.
    const { data: settings } = await admin
      .from('tenant_printful_settings')
      .select('tenant_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!settings) {
      const { error: setErr } = await admin
        .from('tenant_printful_settings')
        .insert({ tenant_id: tenantId });
      if (setErr) throw new Error(setErr.message);
    }

    return json({
      success: true,
      ok: true,
      store_name: test.storeName ?? null,
      // Returned once, only when freshly generated. Not shown in the UI.
      webhook_secret: webhookSecret,
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const msg = (err as Error)?.message ?? JSON.stringify(err);
    console.error('[save-printful-credentials] error:', msg);
    return json({ success: false, error: msg }, 500);
  }
});