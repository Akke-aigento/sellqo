import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { GRAPH_VERSION } from "../_shared/socialPublish.ts";
import { credentialPlatformFor, getOAuthCredentials } from "../_shared/socialOAuthCredentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Platform OAuth configurations
// SOCIAL-1: Graph-versie uit _shared/socialPublish.ts (v18 was verlopen), en een
// eigen 'instagram'-flow via Instagram Login: geen Facebook-pagina nodig.
const PLATFORMS = {
  facebook: {
    authUrl: `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`,
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
  instagram: {
    authUrl: 'https://www.instagram.com/oauth/authorize',
    // SOCIAL-5: manage_insights voor de resultaten (bereik, bewaard, gedeeld) in de Social planning.
    scopes: ['instagram_business_basic', 'instagram_business_content_publish', 'instagram_business_manage_insights'].join(','),
  },
  whatsapp: {
    authUrl: `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`,
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
    const { platform, tenantId, redirectUrl, checkOnly } = await req.json();

    if (!platform || !tenantId || (!redirectUrl && !checkOnly)) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: platform, tenantId, redirectUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ['tenant_admin']);

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

    // Eigen app van de tenant, anders (indien vrijgegeven) de SellQo-platformapp.
    const credentialPlatform = credentialPlatformFor(platform);
    const creds = await getOAuthCredentials(supabase, tenantId, platform);

    // SOCIAL-1: de app vraagt vooraf of koppelen kan, zodat er geen Koppelen-knop
    // verschijnt die enkel op "niet geconfigureerd" uitkomt.
    if (checkOnly) {
      return new Response(
        JSON.stringify({ available: !!creds }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!creds) {
      return new Response(
        JSON.stringify({
          error: `OAuth niet geconfigureerd voor ${platform}. Ga naar Instellingen → API Credentials om je ${credentialPlatform === 'facebook' ? 'Meta' : credentialPlatform} App credentials in te voeren.`,
          missingConfig: true,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientId = creds.clientId;

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
    } else if (platform === 'instagram') {
      // Instagram Login. force_reauth: wie meerdere IG-accounts heeft, kiest bewust het
      // juiste account voor deze winkel in plaats van stil het laatst gebruikte te krijgen.
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${supabaseUrl}/functions/v1/social-oauth-callback`,
        scope: platformConfig.scopes,
        state,
        response_type: 'code',
        force_reauth: 'true',
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
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error('OAuth init error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
