import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Shopify OAuth scopes needed for full integration
const SHOPIFY_SCOPES = [
  'read_products',
  'write_products',
  'read_orders',
  'write_orders',
  'read_inventory',
  'write_inventory',
  'read_customers',
  'read_fulfillments',
  'write_fulfillments',
  'read_locations',
].join(',');

// Custom redirect URI for sellqo.app
const SHOPIFY_REDIRECT_URI = 'https://sellqo.app/api/shopify/callback';

function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, shopUrl, redirectUrl } = await req.json();

    if (!tenantId || !shopUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: tenantId, shopUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and normalize shop URL
    let shopDomain = shopUrl.trim().toLowerCase();
    
    // Remove protocol if present
    shopDomain = shopDomain.replace(/^https?:\/\//, '');
    // Remove trailing slashes
    shopDomain = shopDomain.replace(/\/+$/, '');
    // Remove /admin or other paths
    shopDomain = shopDomain.split('/')[0];
    
    // Add .myshopify.com if not present
    if (!shopDomain.includes('.myshopify.com')) {
      shopDomain = `${shopDomain}.myshopify.com`;
    }

    // Validate domain format
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain)) {
      return new Response(
        JSON.stringify({ error: 'Ongeldige shop URL. Gebruik het format: jouw-winkel.myshopify.com' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Shopify credentials
    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    
    if (!clientId) {
      return new Response(
        JSON.stringify({ 
          error: 'Shopify OAuth niet geconfigureerd. Neem contact op met support.',
          missingConfig: true,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate state and nonce for security
    const state = generateState();
    const nonce = generateNonce();

    // Store state in database for verification during callback
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Store OAuth state with shop domain (expires in 10 minutes)
    await supabase.from('oauth_states').upsert({
      state,
      tenant_id: tenantId,
      platform: 'shopify',
      redirect_url: redirectUrl || '/admin/connect',
      code_verifier: JSON.stringify({ shop: shopDomain, nonce }), // Store shop domain in code_verifier
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    // Build Shopify OAuth URL with custom redirect URI
    const params = new URLSearchParams({
      client_id: clientId,
      scope: SHOPIFY_SCOPES,
      redirect_uri: SHOPIFY_REDIRECT_URI,
      state,
      'grant_options[]': 'per-user', // Request offline access
    });

    const authUrl = `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;

    return new Response(
      JSON.stringify({ authUrl, state, shop: shopDomain }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Shopify OAuth init error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
