import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Platform OAuth configurations
const PLATFORMS = {
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    scopes: [
      'pages_manage_posts',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_content_publish',
      'catalog_management',
      'business_management',
      'pages_read_user_content',
      'pages_messaging',
      'instagram_manage_messages',
      'pages_manage_metadata',
    ].join(','),
  },
  whatsapp: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    scopes: [
      'whatsapp_business_management',
      'whatsapp_business_messaging',
      'business_management',
    ].join(','),
  },
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'].join(' '),
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    scopes: ['r_liteprofile', 'w_member_social'].join(' '),
  },
};

function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { platform, tenantId, redirectUrl } = await req.json();

    if (!platform || !tenantId || !redirectUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: platform, tenantId, redirectUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const platformConfig = PLATFORMS[platform as keyof typeof PLATFORMS];
    if (!platformConfig) {
      return new Response(
        JSON.stringify({ error: `Unsupported platform: ${platform}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine the credential platform (whatsapp uses facebook credentials)
    const credentialPlatform = platform === 'whatsapp' ? 'facebook' : platform;

    // Fetch per-tenant credentials from the database
    const { data: creds, error: credsError } = await supabase
      .from('tenant_oauth_credentials')
      .select('client_id, client_secret')
      .eq('tenant_id', tenantId)
      .eq('platform', credentialPlatform)
      .eq('is_active', true)
      .single();

    if (credsError || !creds) {
      return new Response(
        JSON.stringify({
          error: `OAuth niet geconfigureerd voor ${platform}. Ga naar Instellingen → API Credentials om je ${credentialPlatform === 'facebook' ? 'Meta' : credentialPlatform} App credentials in te voeren.`,
          missingConfig: true,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientId = creds.client_id;

    // Generate state for CSRF protection
    const state = generateState();

    // Store OAuth state temporarily (expires in 10 minutes)
    await supabase.from('oauth_states').upsert({
      state,
      tenant_id: tenantId,
      platform,
      redirect_url: redirectUrl,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    // Build OAuth URL based on platform
    let authUrl: string;

    if (platform === 'facebook' || platform === 'whatsapp') {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${supabaseUrl}/functions/v1/social-oauth-callback`,
        scope: platformConfig.scopes,
        state,
        response_type: 'code',
      });
      authUrl = `${platformConfig.authUrl}?${params.toString()}`;
    } else if (platform === 'twitter') {
      // Twitter uses PKCE
      const codeVerifier = generateState();
      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = new Uint8Array(hashBuffer);
      const codeChallenge = btoa(String.fromCharCode(...hashArray))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await supabase.from('oauth_states').update({ code_verifier: codeVerifier }).eq('state', state);

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${supabaseUrl}/functions/v1/social-oauth-callback`,
        scope: platformConfig.scopes,
        state,
        response_type: 'code',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      authUrl = `${platformConfig.authUrl}?${params.toString()}`;
    } else if (platform === 'linkedin') {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${supabaseUrl}/functions/v1/social-oauth-callback`,
        scope: platformConfig.scopes,
        state,
        response_type: 'code',
      });
      authUrl = `${platformConfig.authUrl}?${params.toString()}`;
    } else {
      throw new Error('Platform not implemented');
    }

    return new Response(
      JSON.stringify({ authUrl, state }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('OAuth init error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
