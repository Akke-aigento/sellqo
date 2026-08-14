// ODOO-OSS-RETRO — read-only recon: lees Odoo-moves + hun regels voor een tenant.
// Schrijft NOOIT naar Odoo. Template: odoo-list-taxes.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from '../_shared/auth.ts';
import { decryptOdooKey } from '../_shared/odooCrypto.ts';
import { odooAuthenticate, odooExecKw, assertValidOdooUrl, type OdooEnv } from '../_shared/odooRpc.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MoveRow {
  id: number;
  name?: string;
  state?: string;
  move_type?: string;
  amount_total?: number;
  amount_tax?: number;
  invoice_line_ids?: number[];
}

interface LineRow {
  id: number;
  name?: string;
  move_id?: [number, string] | false;
  tax_ids?: number[];
  price_subtotal?: number;
  price_total?: number;
  account_id?: [number, string] | false;
  display_type?: string | false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { tenant_id: tenantId, move_ids: moveIds } = body as { tenant_id?: string; move_ids?: number[] };

    if (!tenantId) {
      return new Response(JSON.stringify({ success: false, error: 'tenant_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!Array.isArray(moveIds) || moveIds.length === 0 || !moveIds.every((n) => Number.isInteger(n))) {
      return new Response(JSON.stringify({ success: false, error: 'move_ids must be a non-empty array of integers' }), {
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

    const moves = await odooExecKw(
      env, uid, 'account.move', 'read', [moveIds],
      { fields: ['id', 'name', 'state', 'move_type', 'amount_total', 'amount_tax', 'invoice_line_ids'] },
    ) as MoveRow[];

    const lineIds = Array.from(new Set((moves || []).flatMap((m) => m.invoice_line_ids ?? [])));

    let lines: LineRow[] = [];
    if (lineIds.length) {
      lines = await odooExecKw(
        env, uid, 'account.move.line', 'read', [lineIds],
        { fields: ['id', 'name', 'move_id', 'tax_ids', 'price_subtotal', 'price_total', 'account_id', 'display_type'] },
      ) as LineRow[];
    }

    const result = (moves || []).map((m) => ({
      move: m,
      lines: lines.filter((l) => Array.isArray(l.move_id) && l.move_id[0] === m.id),
    }));

    console.log('[odoo-read-move] read', { tenantId, moves: (moves || []).length, lines: lines.length });

    return new Response(JSON.stringify({ success: true, moves: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    const msg = error instanceof Error ? error.message : 'Onbekende fout';
    console.error('[odoo-read-move] error', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});