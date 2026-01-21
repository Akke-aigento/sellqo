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

interface CreateOfferRequest {
  product_id: string;
  tenant_id: string;
  connection_id: string;
  offer_data: {
    asin?: string;
    sku: string;
    price: number;
    quantity: number;
    condition: 'new' | 'used_like_new' | 'used_very_good' | 'used_good' | 'used_acceptable';
    fulfilment_channel: 'MFN' | 'AFN'; // Merchant or Amazon Fulfillment
    title?: string;
    bullets?: string[];
    description?: string;
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

    const { product_id, tenant_id, connection_id, offer_data }: CreateOfferRequest = await req.json();

    console.log('Creating Amazon offer for product:', product_id);

    // Get marketplace connection credentials
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('credentials, settings')
      .eq('id', connection_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Amazon connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { clientId, clientSecret, refreshToken, marketplaceId = 'nl' } = connection.credentials;
    
    if (!clientId || !clientSecret || !refreshToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid Amazon credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const marketplace = AMAZON_MARKETPLACES[marketplaceId] || AMAZON_MARKETPLACES['nl'];

    // Get access token
    const accessToken = await getAmazonAccessToken(clientId, clientSecret, refreshToken);

    // For Amazon, we use the Listings API to create/update listings
    // This is a simplified implementation - full implementation would use feeds for bulk operations
    const attributes: Record<string, unknown[]> = {
      item_name: [{ value: offer_data.title || 'Product', language_tag: 'nl_NL', marketplace_id: marketplace.id }],
      condition_type: [{ value: offer_data.condition === 'new' ? 'new_new' : offer_data.condition }],
      purchasable_offer: [{
        currency: 'EUR',
        our_price: [{ schedule: [{ value_with_tax: offer_data.price }] }],
        marketplace_id: marketplace.id,
      }],
      fulfillment_availability: [{
        fulfillment_channel_code: offer_data.fulfilment_channel === 'AFN' ? 'AMAZON_NA' : 'DEFAULT',
        quantity: offer_data.quantity,
        marketplace_id: marketplace.id,
      }],
    };

    // Add bullets if provided
    if (offer_data.bullets && offer_data.bullets.length > 0) {
      attributes.bullet_point = offer_data.bullets.map((bullet) => ({
        value: bullet,
        language_tag: 'nl_NL',
        marketplace_id: marketplace.id,
      }));
    }

    // Add description if provided
    if (offer_data.description) {
      attributes.product_description = [{
        value: offer_data.description,
        language_tag: 'nl_NL',
        marketplace_id: marketplace.id,
      }];
    }

    const listingPayload = {
      productType: 'PRODUCT',
      requirements: 'LISTING',
      attributes,
    };

    // Use Listings API to put the listing
    const sku = offer_data.sku || `SELLQO-${product_id}`;
    const sellerId = connection.credentials.sellerId;
    
    const listingsUrl = `https://${marketplace.endpoint}/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}`;
    
    const amazonResponse = await fetch(listingsUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(listingPayload),
    });

    const responseText = await amazonResponse.text();
    
    if (!amazonResponse.ok) {
      console.error('Amazon Listings API error:', responseText);
      
      // Update product with error
      await supabase
        .from('products')
        .update({
          amazon_listing_status: 'error',
          amazon_listing_error: responseText.substring(0, 500),
        })
        .eq('id', product_id);

      return new Response(
        JSON.stringify({ 
          error: 'Failed to create Amazon listing', 
          details: responseText 
        }),
        { status: amazonResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse response
    let amazonData;
    try {
      amazonData = JSON.parse(responseText);
    } catch {
      amazonData = { sku, status: 'ACCEPTED' };
    }

    // Update product with pending/listed status
    const listingStatus = amazonData.status === 'ACCEPTED' ? 'pending' : 'listed';
    
    await supabase
      .from('products')
      .update({
        amazon_listing_status: listingStatus,
        amazon_offer_id: sku,
        amazon_listing_error: null,
        amazon_last_synced_at: new Date().toISOString(),
        amazon_asin: offer_data.asin || null,
        amazon_optimized_title: offer_data.title || null,
        amazon_optimized_description: offer_data.description || null,
        amazon_bullets: offer_data.bullets || null,
      })
      .eq('id', product_id);

    return new Response(
      JSON.stringify({
        success: true,
        sku: sku,
        status: listingStatus,
        message: 'Listing submitted to Amazon. Processing may take some time.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error creating Amazon offer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create listing';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
