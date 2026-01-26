import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('CLOUDFLARE_CLIENT_ID');
    
    if (!clientId) {
      return new Response(
        JSON.stringify({ 
          error: 'Cloudflare OAuth is not configured',
          configured: false,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenant_id, domain, redirect_uri } = await req.json();

    if (!tenant_id || !domain) {
      return new Response(
        JSON.stringify({ error: 'tenant_id and domain are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate state token with tenant info (for callback verification)
    const state = btoa(JSON.stringify({
      tenant_id,
      domain,
      redirect_uri: redirect_uri || `${supabaseUrl}/functions/v1/cloudflare-oauth-callback`,
      timestamp: Date.now(),
    }));

    // Cloudflare OAuth URL
    const callbackUrl = `${supabaseUrl}/functions/v1/cloudflare-oauth-callback`;
    const oauthUrl = new URL('https://dash.cloudflare.com/oauth2/authorize');
    oauthUrl.searchParams.set('client_id', clientId);
    oauthUrl.searchParams.set('redirect_uri', callbackUrl);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('scope', 'zone:read zone.dns:edit');
    oauthUrl.searchParams.set('state', state);

    return new Response(
      JSON.stringify({ 
        oauth_url: oauthUrl.toString(),
        configured: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error initializing Cloudflare OAuth:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to initialize OAuth' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
