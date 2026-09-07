import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAllowedOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

interface AccountInfo {
  id: string;
  name: string;
  avatar?: string;
  profileUrl?: string;
}

async function getCredentialsFromDb(
  supabase: any,
  tenantId: string,
  platform: string
): Promise<{ clientId: string; clientSecret: string }> {
  // whatsapp uses facebook credentials
  const credentialPlatform = platform === 'whatsapp' ? 'facebook' : platform;

  const { data, error } = await supabase
    .from('tenant_oauth_credentials')
    .select('client_id, client_secret')
    .eq('tenant_id', tenantId)
    .eq('platform', credentialPlatform)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error(`No OAuth credentials found for tenant ${tenantId}, platform ${credentialPlatform}`);
  }

  return { clientId: data.client_id, clientSecret: data.client_secret };
}

async function exchangeCodeForToken(
  platform: string,
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  codeVerifier?: string
): Promise<TokenResponse> {
  if (platform === 'facebook' || platform === 'whatsapp') {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });
    const response = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${params}`);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Facebook token exchange failed: ${error}`);
    }
    return response.json();
  } else if (platform === 'twitter') {
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier || '',
    });
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twitter token exchange failed: ${error}`);
    }
    return response.json();
  } else if (platform === 'linkedin') {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LinkedIn token exchange failed: ${error}`);
    }
    return response.json();
  }
  throw new Error('Unsupported platform');
}

async function getAccountInfo(platform: string, accessToken: string): Promise<AccountInfo> {
  if (platform === 'facebook' || platform === 'whatsapp') {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,picture&access_token=${accessToken}`
    );
    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      avatar: data.picture?.data?.url,
      profileUrl: `https://facebook.com/${data.id}`,
    };
  } else if (platform === 'twitter') {
    const response = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const { data } = await response.json();
    return {
      id: data.id,
      name: data.name || data.username,
      avatar: data.profile_image_url,
      profileUrl: `https://x.com/${data.username}`,
    };
  } else if (platform === 'linkedin') {
    const response = await fetch('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName)', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    return {
      id: data.id,
      name: `${data.localizedFirstName} ${data.localizedLastName}`,
      profileUrl: `https://linkedin.com/in/${data.id}`,
    };
  }
  throw new Error('Unsupported platform');
}

/**
 * Basis-URL waar de gebruiker na de OAuth-flow landt.
 *
 * De 302's hieronder gebruikten relatieve paden. Een relatieve Location resolvet
 * tegen de origin van deze functie, dus tegen <project>.supabase.co — waar
 * /admin/settings niet bestaat. De koppeling werd wel opgeslagen, maar de
 * gebruiker landde op een 404. Alle uitgangen zijn nu absoluut.
 */
const FALLBACK_REDIRECT_BASE =
  `${Deno.env.get('PUBLIC_APP_URL') || 'https://sellqo.app'}/admin/settings?section=social`;

/**
 * Alleen onze eigen app-origins mogen de landing bepalen. social-oauth-init slaat
 * `redirect_url` op zonder die te valideren; zonder deze check zou daar een
 * willekeurige host in kunnen staan die wij vervolgens in een 302 zetten.
 *
 * Bewust isAllowedOrigin uit _shared/cors.ts: dat is al de plek waar deze repo
 * definieert wat "van ons" is. Een tweede lijst hier zou uit de pas gaan lopen.
 * Let op dat die functie een origin verwacht (scheme://host:port), niet de hele URL.
 */
function safeRedirectBase(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!isAllowedOrigin(u.origin)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Zet de uitkomst-params op de basis-URL. Via URL.searchParams, want de basis
 * draagt vaak al query-params (`/admin/connect?tab=channels`) — naïef '&' plakken
 * zou die verminken. searchParams encodeert zelf, dus geen encodeURIComponent.
 */
function buildRedirect(base: string, params: Record<string, string>): string {
  const u = new URL(base);
  for (const [key, value] of Object.entries(params)) u.searchParams.set(key, value);
  return u.toString();
}

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return new Response(null, {
        status: 302,
        headers: { Location: buildRedirect(FALLBACK_REDIRECT_BASE, { error }) },
      });
    }

    if (!code || !state) {
      return new Response(null, {
        status: 302,
        headers: { Location: buildRedirect(FALLBACK_REDIRECT_BASE, { error: 'missing_params' }) },
      });
    }

    // Vóór de try, zodat ook het catch-blok onderaan hem kan gebruiken.
    let redirectBase = FALLBACK_REDIRECT_BASE;

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Verify state
      const { data: oauthState, error: stateError } = await supabase
        .from('oauth_states')
        .select('*')
        .eq('state', state)
        .single();

      if (stateError || !oauthState) {
        return new Response(null, {
          status: 302,
          headers: { Location: buildRedirect(FALLBACK_REDIRECT_BASE, { error: 'invalid_state' }) },
        });
      }

      redirectBase = safeRedirectBase(oauthState.redirect_url) ?? FALLBACK_REDIRECT_BASE;

      if (new Date(oauthState.expires_at) < new Date()) {
        await supabase.from('oauth_states').delete().eq('state', state);
        return new Response(null, {
          status: 302,
          headers: { Location: buildRedirect(redirectBase, { error: 'state_expired' }) },
        });
      }

      const { platform, tenant_id, code_verifier } = oauthState;
      const redirectUri = `${supabaseUrl}/functions/v1/social-oauth-callback`;

      // Fetch per-tenant credentials from the database
      const { clientId, clientSecret } = await getCredentialsFromDb(supabase, tenant_id, platform);

      // Exchange code for token
      const tokenData = await exchangeCodeForToken(platform, code, redirectUri, clientId, clientSecret, code_verifier);

      // Get account info
      const accountInfo = await getAccountInfo(platform, tokenData.access_token);

      const tokenExpiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null;

      // Save connection — use the actual platform stored in oauth_states
      const savePlatform = platform === 'whatsapp' ? 'facebook' : platform;
      const { error: insertError } = await supabase.from('social_connections').upsert({
        tenant_id,
        platform: savePlatform,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: tokenExpiresAt,
        account_id: accountInfo.id,
        account_name: accountInfo.name,
        account_avatar: accountInfo.avatar || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,platform',
      });

      if (insertError) {
        console.error('Failed to save connection:', insertError);
        return new Response(null, {
          status: 302,
          headers: { Location: buildRedirect(redirectBase, { error: 'save_failed' }) },
        });
      }

      // For Facebook: Extract page tokens and create meta_messaging_connections
      if (savePlatform === 'facebook') {
        try {
          const pagesResponse = await fetch(
            `https://graph.facebook.com/v18.0/me/accounts?access_token=${tokenData.access_token}`
          );
          const pagesData = await pagesResponse.json();

          if (pagesData.data && Array.isArray(pagesData.data)) {
            for (const page of pagesData.data) {
              await supabase.from('meta_messaging_connections').upsert({
                tenant_id,
                platform: 'facebook',
                page_id: page.id,
                page_name: page.name,
                page_access_token: page.access_token,
                is_active: true,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'tenant_id,platform,page_id',
              });

              const igResponse = await fetch(
                `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
              );
              const igData = await igResponse.json();

              if (igData.instagram_business_account?.id) {
                const igDetailsResponse = await fetch(
                  `https://graph.facebook.com/v18.0/${igData.instagram_business_account.id}?fields=username,name&access_token=${page.access_token}`
                );
                const igDetails = await igDetailsResponse.json();

                await supabase.from('meta_messaging_connections').upsert({
                  tenant_id,
                  platform: 'instagram',
                  page_id: page.id,
                  instagram_account_id: igData.instagram_business_account.id,
                  page_name: igDetails.username || igDetails.name || page.name,
                  page_access_token: page.access_token,
                  is_active: true,
                  updated_at: new Date().toISOString(),
                }, {
                  onConflict: 'tenant_id,platform,page_id',
                });
              }
            }
          }
          console.log('Meta messaging connections created successfully');
        } catch (metaError) {
          console.error('Failed to create meta messaging connections:', metaError);
        }
      }

      // Clean up
      await supabase.from('oauth_states').delete().eq('state', state);

      return new Response(null, {
        status: 302,
        headers: { Location: buildRedirect(redirectBase, { success: 'connected' }) },
      });
    } catch (err: any) {
      console.error('OAuth callback error:', err);
      return new Response(null, {
        status: 302,
        headers: { Location: buildRedirect(redirectBase, { error: err.message ?? 'unknown_error' }) },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
