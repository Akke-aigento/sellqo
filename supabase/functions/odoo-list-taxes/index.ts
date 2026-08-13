// GUEST-VAT-1 — read-only recon: lijst de sale-taxes uit de Odoo van een tenant.
// Schrijft nooit naar Odoo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from '../_shared/auth.ts';
import { decryptOdooKey } from '../_shared/odooCrypto.ts';
import { odooAuthenticate, odooExecKw, assertValidOdooUrl, type OdooEnv } from '../_shared/odooRpc.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = (body as { tenant_id?: string }).tenant_id;
    if (!tenantId) {
      return new Response(JSON.stringify({ success: false, error: 'tenant_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ['tenant_admin']);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: cred, error: credError } = await supabase
      .from('tenant_odoo_credentials')
      .select('odoo_url, odoo_db, odoo_login, api_key_ciphertext')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (credError) throw new Error(`Kon Odoo-credentials niet ophalen: ${credError.message}`);
    if (!cred || !cred.api_key_ciphertext) {
      return new Response(JSON.stringify({ success: false, error: 'Geen Odoo-koppeling voor deze tenant' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const env: OdooEnv = {
      url: assertValidOdooUrl(cred.odoo_url),
      db: cred.odoo_db,
      login: cred.odoo_login,
      apiKey: await decryptOdooKey(cred.api_key_ciphertext),
    };

    const uid = await odooAuthenticate(env);

    const taxes = await odooExecKw(
      env, uid, 'account.tax', 'search_read',
      [[['type_tax_use', '=', 'sale']]],
      { fields: ['id', 'name', 'amount', 'amount_type', 'price_include', 'tax_group_id', 'country_id', 'description'], limit: 200 },
    );

    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle();

    console.log('[odoo-list-taxes] fetched', { tenantId, count: Array.isArray(taxes) ? taxes.length : 0 });

    return new Response(JSON.stringify({
      success: true,
      company_name: tenantRow?.name ?? null,
      taxes,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    const msg = error instanceof Error ? error.message : 'Onbekende fout';
    console.error('[odoo-list-taxes] error', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
