// ODOO-OSS-RETRO — defensieve correctie: vervang op één Odoo-move een tax door een andere.
// Draait NOOIT automatisch; enkel op expliciete aanroep met exacte parameters.
// Patroon: read → verify → (dry_run stop) → draft → write → post → herlees als bewijs.
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
  display_type?: string | false;
}

const LINE_FIELDS = ['id', 'name', 'move_id', 'tax_ids', 'price_subtotal', 'price_total', 'display_type'];
const MOVE_FIELDS = ['id', 'name', 'state', 'move_type', 'amount_total', 'amount_tax', 'invoice_line_ids'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Buiten de try gedeclareerd zodat de catch kan compenseren na een button_draft.
  let env: OdooEnv | null = null;
  let uid: number | null = null;
  let unpostedByUs = false;
  let moveIdForRecovery: number | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const {
      tenant_id: tenantId,
      move_id: moveId,
      from_tax_id: fromTaxId,
      to_tax_id: toTaxId,
      dry_run: dryRun,
    } = body as {
      tenant_id?: string; move_id?: number; from_tax_id?: number; to_tax_id?: number; dry_run?: boolean;
    };

    if (!tenantId) return json({ success: false, error: 'tenant_id is required' }, 400);
    if (!Number.isInteger(moveId)) return json({ success: false, error: 'move_id must be an integer' }, 400);
    if (!Number.isInteger(fromTaxId)) return json({ success: false, error: 'from_tax_id must be an integer' }, 400);
    if (!Number.isInteger(toTaxId)) return json({ success: false, error: 'to_tax_id must be an integer' }, 400);
    if (fromTaxId === toTaxId) return json({ success: false, error: 'from_tax_id and to_tax_id are identical' }, 400);

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
      return json({ success: false, error: 'Geen Odoo-koppeling voor deze tenant' }, 404);
    }

    env = {
      url: assertValidOdooUrl(cred.odoo_url),
      db: cred.odoo_db,
      login: cred.odoo_login,
      apiKey: await decryptOdooKey(cred.api_key_ciphertext),
    };
    uid = await odooAuthenticate(env);
    moveIdForRecovery = moveId as number;

    // 1 — move lezen
    const moves = await odooExecKw(env, uid, 'account.move', 'read', [[moveId]], { fields: MOVE_FIELDS }) as MoveRow[];
    const move = (moves || [])[0];
    if (!move) return json({ success: false, error: `Move ${moveId} not found` }, 404);

    // 2 — regels lezen en doelwit bepalen
    const lineIds = move.invoice_line_ids ?? [];
    const lines = lineIds.length
      ? await odooExecKw(env, uid, 'account.move.line', 'read', [lineIds], { fields: LINE_FIELDS }) as LineRow[]
      : [];

    const isProductLine = (l: LineRow) => !l.display_type || l.display_type === 'product';
    const targets = lines.filter((l) => isProductLine(l) && (l.tax_ids ?? []).includes(fromTaxId as number));

    if (targets.length === 0) {
      // Idempotentie: al gecorrigeerd naar to_tax_id? Dan geen error.
      const already = lines.some((l) => isProductLine(l) && (l.tax_ids ?? []).includes(toTaxId as number));
      if (already) {
        return json({
          success: true,
          already_corrected: true,
          move: { id: move.id, name: move.name, state: move.state, amount_tax: move.amount_tax },
          lines: lines.filter(isProductLine).map((l) => ({ id: l.id, tax_ids: l.tax_ids })),
        });
      }
      return json({ success: false, error: `Move ${moveId} has no line with tax ${fromTaxId} — aborting` }, 400);
    }

    const planned = targets.map((l) => {
      const current = l.tax_ids ?? [];
      const next = Array.from(new Set(current.map((t) => (t === fromTaxId ? (toTaxId as number) : t))));
      return { line_id: l.id, name: l.name, current_tax_ids: current, new_tax_ids: next };
    });

    // 3 — dry run stopt hier
    if (dryRun === true) {
      return json({
        success: true,
        dry_run: true,
        move: { id: move.id, name: move.name, state: move.state, move_type: move.move_type, amount_tax: move.amount_tax },
        planned_changes: planned,
      });
    }

    // 4 — posted → draft
    const originalState = move.state;
    if (originalState === 'posted') {
      await odooExecKw(env, uid, 'account.move', 'button_draft', [[moveId]]);
      unpostedByUs = true;
    }

    // 5 — regels herschrijven
    for (const p of planned) {
      await odooExecKw(env, uid, 'account.move.line', 'write', [[p.line_id], { tax_ids: [[6, 0, p.new_tax_ids]] }]);
    }

    // 6 — terugposten indien nodig
    if (unpostedByUs) {
      await odooExecKw(env, uid, 'account.move', 'action_post', [[moveId]]);
      unpostedByUs = false;
    }

    // 7 — herlezen als bewijs
    const afterMoves = await odooExecKw(env, uid, 'account.move', 'read', [[moveId]], { fields: MOVE_FIELDS }) as MoveRow[];
    const afterMove = (afterMoves || [])[0];
    const afterLineIds = afterMove?.invoice_line_ids ?? [];
    const afterLines = afterLineIds.length
      ? await odooExecKw(env, uid, 'account.move.line', 'read', [afterLineIds], { fields: LINE_FIELDS }) as LineRow[]
      : [];

    console.log('[odoo-correct-move-tax] corrected', { tenantId, moveId, fromTaxId, toTaxId, lines: planned.length });

    return json({
      success: true,
      already_corrected: false,
      original_state: originalState,
      applied_changes: planned,
      after: {
        move: {
          id: afterMove?.id, name: afterMove?.name, state: afterMove?.state,
          amount_total: afterMove?.amount_total, amount_tax: afterMove?.amount_tax,
        },
        lines: afterLines.filter((l) => !l.display_type || l.display_type === 'product')
          .map((l) => ({ id: l.id, name: l.name, tax_ids: l.tax_ids, price_subtotal: l.price_subtotal, price_total: l.price_total })),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error, corsHeaders);
    const msg = error instanceof Error ? error.message : 'Onbekende fout';
    console.error('[odoo-correct-move-tax] error', msg);

    // Compensatie: als wij de move uit 'posted' hebben gehaald, proberen we terug te posten.
    let recovery: string;
    if (unpostedByUs && env && uid !== null && moveIdForRecovery !== null) {
      try {
        await odooExecKw(env, uid, 'account.move', 'action_post', [[moveIdForRecovery]]);
        recovery = 'Move was teruggezet naar draft en is opnieuw geboekt (action_post geslaagd). Controleer de move handmatig.';
      } catch (re) {
        const rmsg = re instanceof Error ? re.message : String(re);
        recovery = `KRITISCH: move staat mogelijk nog in draft — action_post mislukte (${rmsg}). Handmatige controle in Odoo vereist.`;
      }
    } else {
      recovery = 'Geen state-wijziging uitgevoerd; move ongewijzigd.';
    }

    return json({ success: false, error: msg, recovery, manual_check_required: unpostedByUs }, 500);
  }
});