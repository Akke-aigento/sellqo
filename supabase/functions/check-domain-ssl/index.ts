import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";

// SEC-INVITE-1 — GET-versiestempel om de deploy te bewijzen (geen auth, geen bijwerking).
const VERSION = 'SEC-INVITE-1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SSLCheckResult {
  ssl_active: boolean;
  ssl_issuer: string | null;
  ssl_expires_at: string | null;
  error?: string;
  domain_reachable: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ ok: true, version: VERSION }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { domain, tenant_id, domain_id } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const auth = await authenticateRequest(req, tenant_id);
    requireRole(auth, tenant_id, ['tenant_admin']);

    const cleanDomain = domain
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/$/, '')
      .trim();

    console.log(`Checking SSL for domain: ${cleanDomain}`);

    let result: SSLCheckResult = {
      ssl_active: false,
      ssl_issuer: null,
      ssl_expires_at: null,
      domain_reachable: false,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`https://${cleanDomain}`, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);
      result.ssl_active = true;
      result.domain_reachable = true;
      console.log(`SSL check successful for ${cleanDomain}, status: ${response.status}`);
    } catch (fetchError: unknown) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      console.log(`SSL check failed for ${cleanDomain}: ${errorMessage}`);

      if (errorMessage.includes('certificate') || errorMessage.includes('SSL') || 
          errorMessage.includes('CERT') || errorMessage.includes('handshake')) {
        result.domain_reachable = true;
        result.ssl_active = false;
        result.error = 'SSL certificaat nog niet actief';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('abort')) {
        result.domain_reachable = false;
        result.ssl_active = false;
        result.error = 'Domein niet bereikbaar (timeout)';
      } else {
        result.domain_reachable = false;
        result.ssl_active = false;
        result.error = 'Domein niet bereikbaar';
      }
    }

    // Update SSL status
    if (result.ssl_active) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      if (domain_id) {
        // Multi-domain: update tenant_domains.
        // SEC-INVITE-1 — alleen een rij van DEZE winkel, met DNS al geverifieerd, en
        // alleen als het gecontroleerde domein ook het domein van die rij is. Vroeger
        // zette elke tenant_admin ssl_active=true op een willekeurige domain_id (ook van
        // een andere winkel) door een willekeurig HTTPS-domein mee te sturen.
        const { data: row } = await supabase
          .from('tenant_domains')
          .select('id, domain, dns_verified')
          .eq('id', domain_id)
          .eq('tenant_id', tenant_id)
          .maybeSingle();
        const rowDomain = row
          ? String(row.domain).toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').trim()
          : null;
        if (row && row.dns_verified === true && rowDomain === cleanDomain) {
          await supabase
            .from('tenant_domains')
            .update({ ssl_active: true })
            .eq('id', domain_id)
            .eq('tenant_id', tenant_id);
        } else {
          console.warn('[check-domain-ssl] ssl_active niet gezet', {
            domain_id, tenant_id, found: !!row, dns_verified: row?.dns_verified ?? null, matches: rowDomain === cleanDomain,
          });
        }
      } else if (tenant_id) {
        // Legacy: update tenants
        await supabase
          .from('tenants')
          .update({
            ssl_status: 'active',
            ssl_checked_at: new Date().toISOString(),
          })
          .eq('id', tenant_id);
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error('Error in check-domain-ssl:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
