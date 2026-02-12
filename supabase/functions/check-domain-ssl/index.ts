import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  try {
    const { domain, tenant_id, domain_id } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        // Multi-domain: update tenant_domains
        await supabase
          .from('tenant_domains')
          .update({ ssl_active: true })
          .eq('id', domain_id);
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
    console.error('Error in check-domain-ssl:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
