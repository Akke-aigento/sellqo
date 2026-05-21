// vat-report-engine — canonical Belgian VAT-report aggregation engine.
// Admin-only. Reads invoices/credit_notes; writes vat_report_cache only.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse, AuthError } from "../_shared/auth.ts";
import { aggregate } from "./aggregator.ts";
import type {
  DbCreditNote,
  DbCreditNoteLine,
  DbInvoice,
  DbInvoiceLine,
  VatReportPayload,
  VatReportRequest,
} from "./types.ts";

const PERIOD_TYPES = new Set(['monthly', 'quarterly', 'annual', 'custom']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function badRequest(msg: string, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function parseBody(raw: unknown): { ok: true; data: VatReportRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Body must be a JSON object' };
  const b = raw as Record<string, unknown>;
  const tenant_id = b.tenant_id;
  if (typeof tenant_id !== 'string' || !tenant_id) return { ok: false, error: 'tenant_id is required' };
  const period_start = b.period_start;
  const period_end = b.period_end;
  if (typeof period_start !== 'string' || !ISO_DATE.test(period_start)) return { ok: false, error: 'period_start must be YYYY-MM-DD' };
  if (typeof period_end !== 'string' || !ISO_DATE.test(period_end)) return { ok: false, error: 'period_end must be YYYY-MM-DD' };
  if (period_start > period_end) return { ok: false, error: 'period_start must be <= period_end' };
  const period_type = b.period_type;
  if (typeof period_type !== 'string' || !PERIOD_TYPES.has(period_type)) return { ok: false, error: 'period_type invalid' };
  return {
    ok: true,
    data: {
      tenant_id,
      period_start,
      period_end,
      period_type: period_type as VatReportRequest['period_type'],
      include_drafts: b.include_drafts === true,
      include_audit_trail: b.include_audit_trail !== false,
      force_recompute: b.force_recompute === true,
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req);
  const cors = getCorsHeaders(req);

  const startedAt = Date.now();

  let raw: unknown;
  try { raw = await req.json(); } catch { return badRequest('Invalid JSON body', cors); }
  const parsed = parseBody(raw);
  if (!parsed.ok) return badRequest(parsed.error, cors);
  const body = parsed.data;

  // Auth — admin scope on the requested tenant.
  try {
    await authenticateRequest(req, body.tenant_id);
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    throw e;
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // 1) Cache lookup
    if (!body.force_recompute) {
      const { data: cached } = await supabase
        .from('vat_report_cache')
        .select('payload, computed_at')
        .eq('tenant_id', body.tenant_id)
        .eq('period_start', body.period_start)
        .eq('period_end', body.period_end)
        .eq('period_type', body.period_type)
        .is('invalidated_at', null)
        .gt('computed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();
      if (cached?.payload) {
        const payload = cached.payload as VatReportPayload;
        payload.metadata.from_cache = true;
        payload.metadata.duration_ms = Date.now() - startedAt;
        return new Response(JSON.stringify({ success: true, payload }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }

    // 2) Tenant metadata
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name, btw_number, stripe_account_id')
      .eq('id', body.tenant_id)
      .maybeSingle();
    if (tenantErr || !tenant) {
      return new Response(JSON.stringify({ success: false, error: 'Tenant not found' }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // 3) Invoices in period (with customer join)
    const statuses = body.include_drafts ? ['draft', 'sent', 'paid'] : ['sent', 'paid'];
    const { data: invoiceRows, error: invErr } = await supabase
      .from('invoices')
      .select(`
        id, tenant_id, invoice_number, status, subtotal, tax_amount, total, issue_date,
        customer_id, vat_regime, reporting_country,
        vat_number_validated_at, vat_number_validated_value,
        customers:customer_id (
          id, email, first_name, last_name, company_name,
          customer_type, vat_number, billing_country
        )
      `)
      .eq('tenant_id', body.tenant_id)
      .gte('issue_date', body.period_start)
      .lte('issue_date', body.period_end)
      .in('status', statuses);
    if (invErr) throw invErr;
    const invoices = (invoiceRows || []) as unknown as DbInvoice[];

    // 4) Lines in batches of 100 invoices
    const linesByInvoice = new Map<string, DbInvoiceLine[]>();
    const ids = invoices.map((i) => i.id);
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const { data: lineRows, error: lineErr } = await supabase
        .from('invoice_lines')
        .select('id, invoice_id, line_type, description, quantity, unit_price, vat_rate, vat_amount, line_total, vat_box_code, gl_account_code, sort_order')
        .in('invoice_id', batch)
        .order('invoice_id')
        .order('sort_order', { nullsFirst: true });
      if (lineErr) throw lineErr;
      for (const ln of (lineRows || []) as DbInvoiceLine[]) {
        const arr = linesByInvoice.get(ln.invoice_id) || [];
        arr.push(ln);
        linesByInvoice.set(ln.invoice_id, arr);
      }
    }

    // 5) Credit notes
    const cnStatuses = body.include_drafts ? null : ['sent', 'processed'];
    let cnQuery = supabase
      .from('credit_notes')
      .select(`
        id, tenant_id, credit_note_number, original_invoice_id, customer_id,
        subtotal, tax_amount, total, issue_date, status,
        customers:customer_id (
          id, email, first_name, last_name, company_name,
          customer_type, vat_number, billing_country
        )
      `)
      .eq('tenant_id', body.tenant_id)
      .gte('issue_date', body.period_start)
      .lte('issue_date', body.period_end);
    if (cnStatuses) cnQuery = cnQuery.in('status', cnStatuses);
    const { data: cnRows, error: cnErr } = await cnQuery;
    if (cnErr) throw cnErr;
    const creditNotes = (cnRows || []) as unknown as DbCreditNote[];

    // 6) Credit note lines (batched)
    const cnLinesByNote = new Map<string, DbCreditNoteLine[]>();
    const cnIds = creditNotes.map((c) => c.id);
    for (let i = 0; i < cnIds.length; i += 100) {
      const batch = cnIds.slice(i, i + 100);
      const { data: lineRows, error: lineErr } = await supabase
        .from('credit_note_lines')
        .select('id, credit_note_id, line_type, description, quantity, unit_price, vat_rate, vat_amount, line_total')
        .in('credit_note_id', batch);
      if (lineErr) throw lineErr;
      for (const ln of (lineRows || []) as DbCreditNoteLine[]) {
        const arr = cnLinesByNote.get(ln.credit_note_id) || [];
        arr.push(ln);
        cnLinesByNote.set(ln.credit_note_id, arr);
      }
    }

    // Soft-timeout guard: 10s budget for aggregation
    if (Date.now() - startedAt > 10000) {
      return new Response(JSON.stringify({ success: false, error: 'Period too large, consider splitting' }), {
        status: 504, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // 7) Aggregate
    const payload = aggregate({
      tenantMeta: {
        id: tenant.id as string,
        name: (tenant as Record<string, unknown>).name as string ?? null,
        vat_number: (tenant as Record<string, unknown>).btw_number as string ?? null,
        kbo: null,
      },
      period: { start: body.period_start, end: body.period_end, type: body.period_type },
      invoices,
      linesByInvoice,
      creditNotes,
      cnLinesByNote,
      includeAuditTrail: body.include_audit_trail !== false,
      stripeAccountId: ((tenant as Record<string, unknown>).stripe_account_id as string) || null,
    });

    payload.metadata.from_cache = false;
    payload.metadata.duration_ms = Date.now() - startedAt;

    // 8) Cache upsert
    const { error: cacheErr } = await supabase
      .from('vat_report_cache')
      .upsert({
        tenant_id: body.tenant_id,
        period_start: body.period_start,
        period_end: body.period_end,
        period_type: body.period_type,
        payload,
        computed_at: new Date().toISOString(),
        invalidated_at: null,
      }, { onConflict: 'tenant_id,period_start,period_end,period_type' });
    if (cacheErr) {
      console.warn('[vat-report-engine] cache upsert failed:', cacheErr.message);
    }

    return new Response(JSON.stringify({ success: true, payload }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[vat-report-engine] error:', err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});