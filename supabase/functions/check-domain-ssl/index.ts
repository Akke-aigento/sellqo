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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, tenant_id } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean domain
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
      // Try to make a HEAD request to the HTTPS URL
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`https://${cleanDomain}`, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      // If we get here, SSL is working
      result.ssl_active = true;
      result.domain_reachable = true;

      console.log(`SSL check successful for ${cleanDomain}, status: ${response.status}`);

    } catch (fetchError: unknown) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      console.log(`SSL check failed for ${cleanDomain}: ${errorMessage}`);

      // Check if it's a certificate error vs connection error
      if (errorMessage.includes('certificate') || 
          errorMessage.includes('SSL') || 
          errorMessage.includes('CERT') ||
          errorMessage.includes('handshake')) {
        // Certificate error - domain reachable but SSL not ready
        result.domain_reachable = true;
        result.ssl_active = false;
        result.error = 'SSL certificaat nog niet actief';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('abort')) {
        // Timeout - domain might not be configured yet
        result.domain_reachable = false;
        result.ssl_active = false;
        result.error = 'Domein niet bereikbaar (timeout)';
      } else {
        // Other connection error
        result.domain_reachable = false;
        result.ssl_active = false;
        result.error = 'Domein niet bereikbaar';
      }
    }

    // Update tenant SSL status if tenant_id provided
    if (tenant_id && result.ssl_active) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase
        .from('tenants')
        .update({
          ssl_status: result.ssl_active ? 'active' : 'pending',
          ssl_checked_at: new Date().toISOString(),
        })
        .eq('id', tenant_id);
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
