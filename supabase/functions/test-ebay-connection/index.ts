const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EbayCredentials {
  ebayAppId: string;
  ebayCertId: string;
  ebayRefreshToken: string;
  ebayMarketplaceId?: string;
}

async function getAccessToken(credentials: EbayCredentials): Promise<string> {
  const authString = btoa(`${credentials.ebayAppId}:${credentials.ebayCertId}`);
  
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authString}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.ebayRefreshToken,
      scope: 'https://api.ebay.com/oauth/api_scope/sell.fulfillment https://api.ebay.com/oauth/api_scope/sell.inventory',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { credentials } = await req.json();
    
    if (!credentials?.ebayAppId || !credentials?.ebayCertId || !credentials?.ebayRefreshToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'App ID, Cert ID en Refresh Token zijn verplicht',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to get an access token - this validates credentials
    const accessToken = await getAccessToken(credentials);
    
    // Test the token by making a simple API call
    const testResponse = await fetch(
      'https://api.ebay.com/sell/fulfillment/v1/order?limit=1',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': credentials.ebayMarketplaceId || 'EBAY_NL',
        },
      }
    );

    if (!testResponse.ok && testResponse.status !== 404) {
      const error = await testResponse.text();
      throw new Error(`API test failed: ${error}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'eBay verbinding succesvol!',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('eBay connection test error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Verbinding mislukt',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
