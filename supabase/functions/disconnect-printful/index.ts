import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from '../_shared/auth.ts';

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

    const { error: delErr } = await admin
      .from('tenant_printful_credentials')
      .delete()
      .eq('tenant_id', tenantId);
    if (delErr) throw new Error(delErr.message);

    // Variant mappings are intentionally kept: reconnecting restores them.
    const { error: setErr } = await admin
      .from('tenant_printful_settings')
      .update({ printful_sync_enabled: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId);
    if (setErr) throw new Error(setErr.message);

    return json({ success: true, ok: true });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err, corsHeaders);
    const msg = (err as Error)?.message ?? JSON.stringify(err);
    console.error('[disconnect-printful] error:', msg);
    return json({ success: false, error: msg }, 500);
  }
});