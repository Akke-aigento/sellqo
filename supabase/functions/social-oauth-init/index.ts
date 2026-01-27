import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Platform OAuth configurations
const PLATFORMS = {
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    // Updated scopes for Meta Commerce + Messaging (Facebook Shop, Instagram Shop, Messenger, Instagram DMs)
    scopes: [
      'pages_manage_posts',
      'pages_read_engagement', 
      'instagram_basic',
      'instagram_content_publish',
      // Meta Commerce scopes for shop functionality
      'catalog_management',        // Create/update products in catalogs
      'business_management',       // Access business accounts
      'pages_read_user_content',   // Read shop settings
      // Meta Messaging scopes for inbox integration
      'pages_messaging',           // Facebook Messenger conversations
      'instagram_manage_messages', // Instagram DMs
      'pages_manage_metadata',     // Webhook subscriptions for messaging
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

    // Get platform-specific client credentials from secrets
    const clientId = Deno.env.get(`${platform.toUpperCase()}_CLIENT_ID`);
    const clientSecret = Deno.env.get(`${platform.toUpperCase()}_CLIENT_SECRET`);

    if (!clientId) {
      return new Response(
        JSON.stringify({ 
          error: `OAuth niet geconfigureerd voor ${platform}. Neem contact op met support.`,
          missingConfig: true,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate state for CSRF protection
    const state = generateState();

    // Store state in database for verification during callback
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    if (platform === 'facebook') {
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

      // Store code verifier for token exchange
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
