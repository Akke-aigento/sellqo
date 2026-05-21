// warmup-vat-cache — precomputes vat-report-engine cache for closed quarters.
// Admin-only. Calls vat-report-engine with service-role bearer for each closed
// quarter of the requested year, per tenant.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse, AuthError } from "../_shared/auth.ts";

interface WarmupRequest {
  tenant_id?: string;
  year?: number;
}

interface PerEntry {
  tenant_id: string;
  period: string;
  period_start: string;
  period_end: string;
  time_ms: number;
  ok: boolean;
  error?: string;
}

const QUARTERS: Array<{ q: 1 | 2 | 3 | 4; start: string; end: string }> = [
  { q: 1, start: '01-01', end: '03-31' },
  { q: 2, start: '04-01', end: '06-30' },
  { q: 3, start: '07-01', end: '09-30' },
  { q: 4, start: '10-01', end: '12-31' },
];

function badRequest(msg: string, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req);
  const cors = getCorsHeaders(req);
  const t0 = Date.now();

  let body: WarmupRequest = {};
  try {
    if (req.headers.get('content-length') && req.headers.get('content-length') !== '0') {
      body = await req.json() as WarmupRequest;
    }
  } catch {
    return badRequest('Invalid JSON body', cors);
  }

  try {
    const auth = await authenticateRequest(req);
    if (!auth.is_platform_admin && !body.tenant_id) {
      return badRequest('tenant_id required for non-admin callers', cors);
    }
    if (body.tenant_id && !auth.is_platform_admin && !auth.tenant_ids.includes(body.tenant_id)) {
      return new Response(JSON.stringify({ success: false, error: 'No access to tenant' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    const year = body.year ?? now.getUTCFullYear() - 1;
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return badRequest('year out of range', cors);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Collect tenants
    let tenantIds: string[];
    if (body.tenant_id) {
      tenantIds = [body.tenant_id];
    } else {
      const { data, error } = await admin.from('tenants').select('id');
      if (error) throw new Error(`tenants query failed: ${error.message}`);
      tenantIds = (data ?? []).map((r: { id: string }) => r.id);
    }

    const todayIso = now.toISOString().slice(0, 10);
    const per: PerEntry[] = [];

    for (const tid of tenantIds) {
      for (const q of QUARTERS) {
        const period_start = `${year}-${q.start}`;
        const period_end = `${year}-${q.end}`;
        if (period_end >= todayIso) continue; // skip non-closed

        const label = `${year}-Q${q.q}`;
        const started = Date.now();
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/vat-report-engine`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
            },
            body: JSON.stringify({
              tenant_id: tid,
              period_start,
              period_end,
              period_type: 'quarterly',
              force_recompute: true,
              include_audit_trail: false,
            }),
          });
          const dur = Date.now() - started;
          if (!resp.ok) {
            const txt = await resp.text();
            per.push({ tenant_id: tid, period: label, period_start, period_end, time_ms: dur, ok: false, error: `${resp.status} ${txt.slice(0, 200)}` });
          } else {
            await resp.json();
            per.push({ tenant_id: tid, period: label, period_start, period_end, time_ms: dur, ok: true });
          }
          console.log(`[warmup] tenant=${tid} ${label} ${dur}ms ok=${resp.ok}`);
        } catch (e) {
          per.push({ tenant_id: tid, period: label, period_start, period_end, time_ms: Date.now() - started, ok: false, error: (e as Error).message });
        }
      }
    }

    const generated = per.filter((p) => p.ok).length;
    return new Response(JSON.stringify({
      success: true,
      generated,
      attempted: per.length,
      total_time_ms: Date.now() - t0,
      year,
      per_tenant_per_period: per,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e, cors);
    console.error('[warmup-vat-cache] error', e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});