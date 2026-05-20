// Thin HTTP wrapper around `_shared/regimeResolver.ts`.
// Public interface unchanged — see RegimeInput / RegimeResolution.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";
import { authenticateRequest, authErrorResponse, AuthError } from "../_shared/auth.ts";
import { resolveVatRegime, type RegimeInput } from "../_shared/regimeResolver.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req);
  const cors = getCorsHeaders(req);

  try {
    let body: RegimeInput;
    try {
      body = await req.json() as RegimeInput;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!body?.tenant_id || !body?.customer_id || !Array.isArray(body?.invoice_lines)) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: tenant_id, customer_id, invoice_lines',
      }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

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

    const result = await resolveVatRegime(supabase, body);
    console.log('[resolve-vat-regime] resolved', JSON.stringify({
      tenant_id: body.tenant_id, customer_id: body.customer_id,
      regime: result.invoice_level.vat_regime, lines: result.per_line.length,
      warnings: result.warnings.length,
    }));

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[resolve-vat-regime] unhandled error', err);
    const msg = err instanceof Error ? err.message : 'Internal error';
    const status = msg === 'Customer not found' ? 404 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});