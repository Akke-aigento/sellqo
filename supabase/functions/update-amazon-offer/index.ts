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

interface UpdateOfferRequest {
  product_id: string;
  tenant_id: string;
  connection_id: string;
  sku: string;
  update_type: 'price' | 'quantity' | 'all';
  update_data: {
    price?: number;
    quantity?: number;
  };
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

    const { product_id, tenant_id, connection_id, sku, update_type, update_data }: UpdateOfferRequest = await req.json();

    console.log('Updating Amazon offer:', sku, update_type);

    // Get marketplace connection credentials
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('credentials')
      .eq('id', connection_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Amazon connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { clientId, clientSecret, refreshToken, sellerId, marketplaceId = 'nl' } = connection.credentials;
    
    if (!clientId || !clientSecret || !refreshToken || !sellerId) {
      return new Response(
        JSON.stringify({ error: 'Invalid Amazon credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const marketplace = AMAZON_MARKETPLACES[marketplaceId] || AMAZON_MARKETPLACES['nl'];

    // Get access token
    const accessToken = await getAmazonAccessToken(clientId, clientSecret, refreshToken);

    // Build patch payload based on update type
    const patches = [];

    if ((update_type === 'price' || update_type === 'all') && update_data.price !== undefined) {
      patches.push({
        op: 'replace',
        path: '/attributes/purchasable_offer',
        value: [{
          currency: 'EUR',
          our_price: [{ schedule: [{ value_with_tax: update_data.price }] }],
          marketplace_id: marketplace.id,
        }],
      });
    }

    if ((update_type === 'quantity' || update_type === 'all') && update_data.quantity !== undefined) {
      patches.push({
        op: 'replace',
        path: '/attributes/fulfillment_availability',
        value: [{
          fulfillment_channel_code: 'DEFAULT',
          quantity: update_data.quantity,
          marketplace_id: marketplace.id,
        }],
      });
    }

    if (patches.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid updates provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Listings API to patch the listing
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
        patches,
      }),
    });

    const responseText = await amazonResponse.text();
    
    if (!amazonResponse.ok) {
      console.error('Amazon Listings API error:', responseText);

      return new Response(
        JSON.stringify({ 
          error: 'Failed to update Amazon listing', 
          details: responseText 
        }),
        { status: amazonResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update sync timestamp
    await supabase
      .from('products')
      .update({
        amazon_last_synced_at: new Date().toISOString(),
        amazon_listing_error: null,
      })
      .eq('id', product_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Amazon listing updated successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error updating Amazon offer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update listing';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
