// ODOO-2: per-tenant Odoo connection self-service.
// Actions: save | test | status | journals
// Auth: tenant_admin of own tenant, or platform_admin (bypass in requireRole).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from '../_shared/auth.ts';
import { assertValidOdooUrl, odooAuthenticate, odooVersion, odooExecKw, type OdooEnv } from '../_shared/odooRpc.ts';
import { encryptOdooKey, decryptOdooKey } from '../_shared/odooCrypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function loadStoredEnv(supabase: ReturnType<typeof createClient>, tenantId: string): Promise<OdooEnv | null> {
  const { data, error } = await supabase
    .from('tenant_odoo_credentials')
    .select('odoo_url, odoo_db, odoo_login, api_key_ciphertext')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw new Error(`Load credentials: ${errMsg(error)}`);
  if (!data) return null;
  const apiKey = await decryptOdooKey(data.api_key_ciphertext as string);
  return { url: data.odoo_url as string, db: data.odoo_db as string, login: data.odoo_login as string, apiKey };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, tenantId } = body as { action?: string; tenantId?: string };

    if (!action || !tenantId) return jsonResponse({ success: false, error: 'action en tenantId zijn verplicht' }, 400);

    // OWN-TENANT GUARD (hard): authenticateRequest throws 403 on mismatch for non-platform-admins.
    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ['tenant_admin']);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    if (action === 'status') {
      const { data, error } = await supabase
        .from('tenant_odoo_credentials')
        .select('odoo_url, odoo_db, odoo_login, connected_version, last_test_at, last_test_ok')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) throw new Error(errMsg(error));
      return jsonResponse({
        success: true,
        configured: !!data,
        odoo_url: data?.odoo_url ?? null,
        odoo_db: data?.odoo_db ?? null,
        odoo_login: data?.odoo_login ?? null,
        has_key: !!data,
        connected_version: data?.connected_version ?? null,
        last_test_at: data?.last_test_at ?? null,
        last_test_ok: data?.last_test_ok ?? null,
      });
    }

    if (action === 'save') {
      const { odoo_url, odoo_db, odoo_login, odoo_api_key } = body as {
        odoo_url?: string; odoo_db?: string; odoo_login?: string; odoo_api_key?: string;
      };
      if (!odoo_url || !odoo_db || !odoo_login) return jsonResponse({ success: false, error: 'URL, database en login zijn verplicht.' }, 400);

      let normalizedUrl: string;
      try { normalizedUrl = assertValidOdooUrl(odoo_url); }
      catch (e) { return jsonResponse({ success: false, error: errMsg(e) }, 400); }

      // If api_key not provided, must already be stored — reuse ciphertext by decrypting existing.
      let apiKey = odoo_api_key?.trim() || '';
      if (!apiKey) {
        const existing = await loadStoredEnv(supabase, tenantId);
        if (!existing) return jsonResponse({ success: false, error: 'API-key is verplicht bij eerste configuratie.' }, 400);
        apiKey = existing.apiKey;
      }

      const env: OdooEnv = { url: normalizedUrl, db: odoo_db.trim(), login: odoo_login.trim(), apiKey };
      // Live test — expected auth failures return 400 with a helpful Dutch message.
      let version: Awaited<ReturnType<typeof odooVersion>>;
      try {
        await odooAuthenticate(env);
        version = await odooVersion(env);
      } catch (e) {
        return jsonResponse({
          success: false,
          error:
            'Odoo-authenticatie mislukt. Controleer database, login en API-key — en let op: de API-key moet aangemaakt zijn onder dezelfde Odoo-gebruiker als de login, met volledig bereik. (' +
            errMsg(e) + ')',
        }, 400);
      }

      const ciphertext = await encryptOdooKey(apiKey);
      const { error: upErr } = await supabase.from('tenant_odoo_credentials').upsert({
        tenant_id: tenantId,
        odoo_url: normalizedUrl,
        odoo_db: env.db,
        odoo_login: env.login,
        api_key_ciphertext: ciphertext,
        connected_version: version.server_version ?? null,
        last_test_at: new Date().toISOString(),
        last_test_ok: true,
      }, { onConflict: 'tenant_id' });
      if (upErr) throw new Error(errMsg(upErr));

      return jsonResponse({ success: true, ok: true, version: version.server_version });
    }

    if (action === 'test') {
      const env = await loadStoredEnv(supabase, tenantId);
      if (!env) return jsonResponse({ success: false, error: 'Nog geen verbinding geconfigureerd.' }, 400);
      try {
        await odooAuthenticate(env);
        const version = await odooVersion(env);
        await supabase.from('tenant_odoo_credentials').update({
          last_test_at: new Date().toISOString(), last_test_ok: true, connected_version: version.server_version ?? null,
        }).eq('tenant_id', tenantId);
        return jsonResponse({ success: true, ok: true, version: version.server_version });
      } catch (e) {
        await supabase.from('tenant_odoo_credentials').update({
          last_test_at: new Date().toISOString(), last_test_ok: false,
        }).eq('tenant_id', tenantId);
        return jsonResponse({ success: false, ok: false, error: errMsg(e) });
      }
    }

    if (action === 'journals') {
      const env = await loadStoredEnv(supabase, tenantId);
      if (!env) return jsonResponse({ success: false, error: 'Nog geen verbinding geconfigureerd.' }, 400);
      const uid = await odooAuthenticate(env);
      const journals = await odooExecKw(env, uid, 'account.journal', 'search_read',
        [[['type', '=', 'sale']]], { fields: ['id', 'name', 'code'], limit: 100 }) as Array<{ id: number; name: string; code: string }>;

      // Cross-tenant conflict data: which of these journals are already claimed by another tenant on the same (url, db)?
      const { data: otherCreds } = await supabase
        .from('tenant_odoo_credentials')
        .select('tenant_id')
        .eq('odoo_url', env.url)
        .eq('odoo_db', env.db)
        .neq('tenant_id', tenantId);
      const otherTenantIds = (otherCreds || []).map((r: { tenant_id: string }) => r.tenant_id);
      let claimed: Record<string, string> = {};
      if (otherTenantIds.length) {
        const { data: claimedRows } = await supabase
          .from('tenant_odoo_settings')
          .select('tenant_id, odoo_journal_id')
          .in('tenant_id', otherTenantIds)
          .not('odoo_journal_id', 'is', null);
        claimed = Object.fromEntries((claimedRows || []).map((r: { tenant_id: string; odoo_journal_id: string }) => [String(r.odoo_journal_id), r.tenant_id]));
      }

      return jsonResponse({
        success: true,
        journals: journals.map(j => ({ id: j.id, name: j.name, code: j.code, claimed_by_other_tenant: !!claimed[String(j.id)] })),
      });
    }

    return jsonResponse({ success: false, error: `Onbekende actie: ${action}` }, 400);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    console.error('manage-odoo-connection:', errMsg(error));
    return jsonResponse({ success: false, error: errMsg(error) }, 500);
  }
});