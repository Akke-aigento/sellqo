import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShopifyTokenResponse {
  access_token: string;
  scope: string;
}

interface ShopifyShopInfo {
  shop: {
    id: number;
    name: string;
    email: string;
    domain: string;
    myshopify_domain: string;
    shop_owner: string;
    currency: string;
    timezone: string;
  };
}

async function exchangeCodeForToken(
  shop: string,
  code: string
): Promise<ShopifyTokenResponse> {
  const clientId = Deno.env.get('SHOPIFY_CLIENT_ID')!;
  const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET')!;

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token exchange failed:', error);
    throw new Error(`Shopify token exchange failed: ${response.status}`);
  }

  return response.json();
}

async function getShopInfo(shop: string, accessToken: string): Promise<ShopifyShopInfo> {
  const response = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to get shop info:', error);
    throw new Error('Failed to get shop info');
  }

  return response.json();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Handle POST requests (from frontend callback page)
  if (req.method === 'POST') {
    try {
      const { code, state, shop } = await req.json();

      if (!code || !state || !shop) {
        return new Response(
          JSON.stringify({ error: 'Ontbrekende parameters: code, state, of shop' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify state and get stored data
      const { data: oauthState, error: stateError } = await supabase
        .from('oauth_states')
        .select('*')
        .eq('state', state)
        .single();

      if (stateError || !oauthState) {
        console.error('Invalid or missing state:', stateError);
        return new Response(
          JSON.stringify({ error: 'Ongeldige of verlopen sessie. Probeer opnieuw.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if state expired
      if (new Date(oauthState.expires_at) < new Date()) {
        await supabase.from('oauth_states').delete().eq('state', state);
        return new Response(
          JSON.stringify({ error: 'Sessie verlopen. Probeer opnieuw.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify platform
      if (oauthState.platform !== 'shopify') {
        return new Response(
          JSON.stringify({ error: 'Platform mismatch' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get stored shop from code_verifier
      let storedData: { shop: string; nonce: string };
      try {
        storedData = JSON.parse(oauthState.code_verifier || '{}');
      } catch {
        storedData = { shop: '', nonce: '' };
      }

      // Verify shop matches
      if (storedData.shop && storedData.shop !== shop) {
        console.error('Shop mismatch:', storedData.shop, '!=', shop);
        return new Response(
          JSON.stringify({ error: 'Shop mismatch. Probeer opnieuw.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { tenant_id } = oauthState;

      // Exchange code for token
      const tokenData = await exchangeCodeForToken(shop, code);

      // Get shop info
      const shopInfo = await getShopInfo(shop, tokenData.access_token);

      // Save connection to marketplace_connections table
      const { error: insertError } = await supabase.from('marketplace_connections').upsert({
        tenant_id,
        marketplace_type: 'shopify',
        marketplace_name: shopInfo.shop.name || shop,
        credentials: {
          shop_url: shop,
          access_token: tokenData.access_token,
          scope: tokenData.scope,
        },
        settings: {
          currency: shopInfo.shop.currency,
          timezone: shopInfo.shop.timezone,
          shop_owner: shopInfo.shop.shop_owner,
          primary_domain: shopInfo.shop.domain,
        },
        is_active: true,
        last_sync_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,marketplace_type',
      });

      if (insertError) {
        console.error('Failed to save connection:', insertError);
        return new Response(
          JSON.stringify({ error: 'Opslaan van koppeling mislukt' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Clean up OAuth state
      await supabase.from('oauth_states').delete().eq('state', state);

      return new Response(
        JSON.stringify({ 
          success: true, 
          shopName: shopInfo.shop.name,
          shopDomain: shopInfo.shop.domain,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      console.error('Shopify OAuth callback error:', err);
      return new Response(
        JSON.stringify({ error: err.message || 'Onbekende fout opgetreden' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
