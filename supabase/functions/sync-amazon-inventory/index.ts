import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AMAZON_LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';

const AMAZON_MARKETPLACES: Record<string, { id: string; endpoint: string }> = {
  'nl': { id: 'A1805IZSGTT6HS', endpoint: 'sellingpartnerapi-eu.amazon.com' },
  'de': { id: 'A1PA6795UKMFR9', endpoint: 'sellingpartnerapi-eu.amazon.com' },
  'fr': { id: 'A13V1IB3VIYZZH', endpoint: 'sellingpartnerapi-eu.amazon.com' },
  'be': { id: 'AMEN7PMS3EDWL', endpoint: 'sellingpartnerapi-eu.amazon.com' },
  'uk': { id: 'A1F83G8C2ARO7P', endpoint: 'sellingpartnerapi-eu.amazon.com' },
  'us': { id: 'ATVPDKIKX0DER', endpoint: 'sellingpartnerapi-na.amazon.com' },
};

interface SyncRequest {
  connectionId: string;
}

async function getAmazonAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch(AMAZON_LWA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Amazon access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { connectionId }: SyncRequest = await req.json();

    console.log('Syncing Amazon inventory for connection:', connectionId);

    // Get connection with credentials
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*, tenant_id')
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { clientId, clientSecret, refreshToken, sellerId, marketplaceId = 'nl' } = connection.credentials;
    const tenantId = connection.tenant_id;
    const marketplace = AMAZON_MARKETPLACES[marketplaceId] || AMAZON_MARKETPLACES['nl'];

    if (!clientId || !clientSecret || !refreshToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid Amazon credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token
    const accessToken = await getAmazonAccessToken(clientId, clientSecret, refreshToken);

    // Get products that have Amazon listing enabled
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, stock, amazon_offer_id, amazon_asin')
      .eq('tenant_id', tenantId)
      .eq('amazon_listing_status', 'listed')
      .not('amazon_offer_id', 'is', null);

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }

    let productsSynced = 0;
    let syncErrors = 0;

    // Sync inventory for each product
    for (const product of products || []) {
      try {
        const sku = product.amazon_offer_id;
        if (!sku) continue;

        // Use Listings API to update inventory
        const listingsUrl = `https://${marketplace.endpoint}/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}`;
        
        const amazonResponse = await fetch(listingsUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-amz-access-token': accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productType: 'PRODUCT',
            patches: [{
              op: 'replace',
              path: '/attributes/fulfillment_availability',
              value: [{
                fulfillment_channel_code: 'DEFAULT',
                quantity: product.stock || 0,
                marketplace_id: marketplace.id,
              }],
            }],
          }),
        });

        if (amazonResponse.ok) {
          // Update sync timestamp
          await supabase
            .from('products')
            .update({ amazon_last_synced_at: new Date().toISOString() })
            .eq('id', product.id);
          
          productsSynced++;
        } else {
          const errorText = await amazonResponse.text();
          console.error('Failed to sync product:', product.id, errorText);
          syncErrors++;
        }
      } catch (productError) {
        console.error('Error syncing product:', product.id, productError);
        syncErrors++;
      }
    }

    // Update connection
    await supabase
      .from('marketplace_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: syncErrors > 0 ? `${syncErrors} products failed to sync` : null,
      })
      .eq('id', connectionId);

    return new Response(
      JSON.stringify({
        success: true,
        productsSynced,
        syncErrors,
        totalProducts: products?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error syncing Amazon inventory:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync inventory';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
