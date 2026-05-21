// regression-test-vat — compares raw invoice_lines aggregation against the
// vat-report-engine output to detect drift. Admin-only.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse, AuthError } from "../_shared/auth.ts";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TOLERANCE_EUR = 1.0;

interface RegressionRequest {
  tenant_id: string;
  period_start: string;
  period_end: string;
}

interface TestCase {
  rate: number;
  raw_base: number;
  engine_base: number;
  diff: number;
  pass: boolean;
  note?: string;
}

function badRequest(msg: string, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req);
  const cors = getCorsHeaders(req);

  let raw: unknown;
  try { raw = await req.json(); } catch { return badRequest('Invalid JSON body', cors); }
  const b = (raw ?? {}) as Record<string, unknown>;
  if (typeof b.tenant_id !== 'string' || !b.tenant_id) return badRequest('tenant_id required', cors);
  if (typeof b.period_start !== 'string' || !ISO_DATE.test(b.period_start)) return badRequest('period_start invalid', cors);
  if (typeof b.period_end !== 'string' || !ISO_DATE.test(b.period_end)) return badRequest('period_end invalid', cors);
  const body: RegressionRequest = { tenant_id: b.tenant_id, period_start: b.period_start, period_end: b.period_end };

  try {
    await authenticateRequest(req, body.tenant_id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Step 1: fetch raw lines via header invoices (tenant-scoped) + their lines
    const { data: invs, error: invErr } = await admin
      .from('invoices')
      .select('id, status, issue_date')
      .eq('tenant_id', body.tenant_id)
      .gte('issue_date', body.period_start)
      .lte('issue_date', body.period_end)
      .in('status', ['sent', 'paid']);
    if (invErr) throw new Error(`invoices query failed: ${invErr.message}`);
    const invIds = (invs ?? []).map((r: { id: string }) => r.id);

    const rawByRate = new Map<number, { base: number; vat: number }>();
    if (invIds.length > 0) {
      const { data: lines, error: lnErr } = await admin
        .from('invoice_lines')
        .select('invoice_id, vat_rate, vat_amount, line_total')
        .in('invoice_id', invIds);
      if (lnErr) throw new Error(`invoice_lines query failed: ${lnErr.message}`);
      for (const l of (lines ?? []) as Array<{ vat_rate: number; vat_amount: number; line_total: number }>) {
        const rate = Number(l.vat_rate ?? 0);
        const base = Number(l.line_total ?? 0) - Number(l.vat_amount ?? 0);
        const cur = rawByRate.get(rate) ?? { base: 0, vat: 0 };
        cur.base += base;
        cur.vat += Number(l.vat_amount ?? 0);
        rawByRate.set(rate, cur);
      }
    }

    // Step 2: call vat-report-engine
    const engResp = await fetch(`${supabaseUrl}/functions/v1/vat-report-engine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify({
        tenant_id: body.tenant_id,
        period_start: body.period_start,
        period_end: body.period_end,
        period_type: 'custom',
        force_recompute: true,
        include_audit_trail: false,
      }),
    });
    if (!engResp.ok) {
      const txt = await engResp.text();
      throw new Error(`engine call failed: ${engResp.status} ${txt}`);
    }
    const engine = await engResp.json();
    const payload = engine.data ?? engine.payload ?? engine;
    const boxes = payload?.declaration_boxes ?? {};
    const warnings: string[] = Array.isArray(payload?.warnings) ? [...payload.warnings] : [];

    const box = (code: string) => Number(boxes?.[code]?.amount ?? 0);

    // Step 3: build test cases
    const cases: TestCase[] = [];
    const r6 = rawByRate.get(6)?.base ?? 0;
    const r12 = rawByRate.get(12)?.base ?? 0;
    const r21 = rawByRate.get(21)?.base ?? 0;
    const r0 = rawByRate.get(0)?.base ?? 0;

    // Box 01 ↔ rate 6
    {
      const eng = box('01');
      const diff = round2(eng - r6);
      cases.push({ rate: 6, raw_base: round2(r6), engine_base: round2(eng), diff, pass: Math.abs(diff) <= TOLERANCE_EUR });
    }
    // Box 02 ↔ rate 12
    {
      const eng = box('02');
      const diff = round2(eng - r12);
      cases.push({ rate: 12, raw_base: round2(r12), engine_base: round2(eng), diff, pass: Math.abs(diff) <= TOLERANCE_EUR });
    }
    // Box 03 + IC (44,45,46,47) ↔ rate 21 + rate 0
    {
      const ic = box('44') + box('45') + box('46') + box('47');
      const eng = box('03') + ic;
      const rawCombined = r21 + r0;
      const diff = round2(eng - rawCombined);
      cases.push({
        rate: 21,
        raw_base: round2(rawCombined),
        engine_base: round2(eng),
        diff,
        pass: Math.abs(diff) <= TOLERANCE_EUR,
        note: 'box 03 + IC/export boxes (44/45/46/47) vs raw rate 21 + rate 0 lines',
      });
    }

    const total_pass = cases.every((c) => c.pass);
    if (!total_pass) {
      warnings.unshift('Regression mismatch detected — see test_cases');
    }

    return new Response(JSON.stringify({
      success: true,
      tenant_id: body.tenant_id,
      period_start: body.period_start,
      period_end: body.period_end,
      raw_invoice_count: invIds.length,
      engine_invoice_count: payload?.metadata?.invoice_count ?? null,
      test_cases: cases,
      total_pass,
      warnings,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error('[regression-test-vat] error', e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});