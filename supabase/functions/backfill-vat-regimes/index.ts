// Backfill VAT-regime / box / GL on historical invoices using the canonical
// regime resolver. Admin-only. Batched (max 100 per call) for timeout safety.
// dry_run=true never writes; returns transition distribution + sample changes.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse, AuthError } from "../_shared/auth.ts";
import { resolveVatRegime } from "../_shared/regimeResolver.ts";

interface BackfillBody {
  tenant_id?: string;
  dry_run?: boolean;
  limit?: number;
}

interface SampleChange {
  invoice_id: string;
  invoice_number: string | null;
  old_regime: string | null;
  new_regime: string;
  customer_country: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req);
  const cors = getCorsHeaders(req);

  try {
    let body: BackfillBody = {};
    try { body = await req.json() as BackfillBody; } catch { /* allow empty body */ }

    // Default to dry_run=true so an accidental call cannot mutate data.
    const dryRun = body.dry_run !== false;
    const limit = Math.min(Math.max(body.limit ?? 100, 1), 100);

    // Auth — must be admin; tenant scope optional.
    let auth;
    try {
      auth = await authenticateRequest(req, body.tenant_id);
    } catch (e) {
      if (e instanceof AuthError) return authErrorResponse(e, cors);
      throw e;
    }
    if (!auth.is_platform_admin && !body.tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id is required for non-platform admins' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Candidate invoices: missing or default-only regime, with a customer.
    let q = supabase
      .from('invoices')
      .select('id, invoice_number, tenant_id, customer_id, vat_regime, issue_date')
      .not('customer_id', 'is', null)
      .or('vat_regime.is.null,vat_regime.eq.domestic_standard')
      .order('issue_date', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (body.tenant_id) q = q.eq('tenant_id', body.tenant_id);
    else if (!auth.is_platform_admin && auth.tenant_ids.length > 0) {
      q = q.in('tenant_id', auth.tenant_ids);
    }

    const { data: invoices, error: invErr } = await q;
    if (invErr) {
      return new Response(JSON.stringify({ error: `Invoice query failed: ${invErr.message}` }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const total_processed = invoices?.length ?? 0;
    let updated = 0;
    let unchanged = 0;
    const errors: Array<{ invoice_id: string; error: string }> = [];
    const samples: SampleChange[] = [];
    const distribution = new Map<string, number>(); // "oldRegime -> newRegime" -> count

    for (const inv of invoices ?? []) {
      try {
        // Pull invoice_lines for accurate per-line resolution.
        const { data: lines } = await supabase
          .from('invoice_lines')
          .select('product_id, line_type, line_total')
          .eq('invoice_id', inv.id);

        const regimeLines = (lines ?? []).map((l) => ({
          product_id: (l.product_id as string | null) || undefined,
          line_type: ((l.line_type as string) || 'product') as 'product' | 'shipping' | 'discount',
          amount: Number(l.line_total) || 0,
        }));
        if (regimeLines.length === 0) {
          regimeLines.push({ product_id: undefined, line_type: 'product', amount: 0 });
        }

        const resolution = await resolveVatRegime(supabase, {
          tenant_id: inv.tenant_id as string,
          customer_id: inv.customer_id as string,
          invoice_lines: regimeLines,
        });

        const oldRegime = (inv.vat_regime as string | null) ?? null;
        const newRegime = resolution.invoice_level.vat_regime;
        const key = `${oldRegime ?? 'null'} -> ${newRegime}`;
        distribution.set(key, (distribution.get(key) ?? 0) + 1);

        // Intelligent compare: skip when nothing meaningful would change.
        const sameRegime = oldRegime === newRegime;
        if (sameRegime) {
          unchanged++;
          continue;
        }

        if (samples.length < 20) {
          samples.push({
            invoice_id: inv.id as string,
            invoice_number: (inv.invoice_number as string | null) ?? null,
            old_regime: oldRegime,
            new_regime: newRegime,
            customer_country: resolution.invoice_level.reporting_country,
          });
        }

        if (!dryRun) {
          const invPatch: Record<string, unknown> = {
            vat_regime: newRegime,
            reporting_country: resolution.invoice_level.reporting_country,
          };
          if (resolution.invoice_level.vat_number_validated_at) {
            invPatch.vat_number_validated_at = resolution.invoice_level.vat_number_validated_at;
          }
          if (resolution.invoice_level.vat_number_validated_value) {
            invPatch.vat_number_validated_value = resolution.invoice_level.vat_number_validated_value;
          }
          const { error: updErr } = await supabase
            .from('invoices').update(invPatch).eq('id', inv.id);
          if (updErr) {
            errors.push({ invoice_id: inv.id as string, error: updErr.message });
            continue;
          }

          // Patch invoice_lines (best-effort, per line by sort_order).
          for (let i = 0; i < (lines ?? []).length; i++) {
            const per = resolution.per_line[i];
            if (!per) continue;
            await supabase
              .from('invoice_lines')
              .update({ vat_box_code: per.vat_box_code, gl_account_code: per.gl_account_code })
              .eq('invoice_id', inv.id)
              .eq('sort_order', i);
          }

          updated++;
        } else {
          updated++; // count "would update" in dry-run
        }
      } catch (e) {
        errors.push({ invoice_id: inv.id as string, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const distributionObj: Record<string, number> = {};
    for (const [k, v] of distribution.entries()) distributionObj[k] = v;

    return new Response(JSON.stringify({
      dry_run: dryRun,
      total_processed,
      updated,
      unchanged,
      errors,
      distribution: distributionObj,
      sample_changes: samples,
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[backfill-vat-regimes] unhandled', err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Internal error',
    }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});