import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authenticateRequest, authErrorResponse, AuthError, type AppRole } from "../_shared/auth.ts";
import { callVies, cleanVatNumber, isEuCountry, parseVatCountry } from "../_shared/vies.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_ROLES: AppRole[] = ['tenant_admin', 'staff', 'accountant'];

function hasAdminRole(rolesByTenant: Record<string, AppRole[]> | undefined): boolean {
  if (!rolesByTenant) return false;
  for (const list of Object.values(rolesByTenant)) {
    if (list.some((r) => ADMIN_ROLES.includes(r))) return true;
  }
  return false;
}

function logStep(step: string, details?: Record<string, unknown>) {
  console.log(`[VIES-VALIDATE] ${step}`, details ? JSON.stringify(details) : '');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Batch 2D-iv / OB8: validate-vat is admin-only. Auth required +
    // user must hold tenant_admin, staff or accountant in any tenant
    // (platform_admin / service-role bypass via authenticateRequest).
    try {
      const auth = await authenticateRequest(req);
      if (!auth.is_platform_admin && !hasAdminRole(auth.roles_by_tenant)) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: admin role required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } catch (e) {
      if (e instanceof AuthError) return authErrorResponse(e, corsHeaders);
      throw e;
    }

    const { vat_number } = await req.json();
    logStep('Received request', { vat_number });

    if (!vat_number) {
      return new Response(
        JSON.stringify({ error: 'BTW-nummer is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean the VAT number - remove spaces and convert to uppercase
    const cleanVat = cleanVatNumber(vat_number);
    logStep('Cleaned VAT number', { cleanVat });

    // Extract country code (first 2 characters)
    const { countryCode, number: vatNumberWithoutCountry } = parseVatCountry(cleanVat);

    if (!isEuCountry(countryCode)) {
      logStep('Invalid country code', { countryCode });
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: `Ongeldige landcode: ${countryCode}. Alleen EU-landen worden ondersteund.` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const viesData = await callVies(countryCode, vatNumberWithoutCountry);

    if (viesData.error) {
      return new Response(
        JSON.stringify({ valid: false, error: viesData.error }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        valid: viesData.valid,
        vat_number: cleanVat,
        country_code: countryCode,
        company_name: viesData.company_name,
        address: viesData.address,
        request_date: viesData.request_date,
        request_identifier: viesData.request_identifier,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logStep('Error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: 'Er is een fout opgetreden bij het valideren van het BTW-nummer' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
