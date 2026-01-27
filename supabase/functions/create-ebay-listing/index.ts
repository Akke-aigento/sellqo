import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EBAY_API_URL = 'https://api.ebay.com';

interface EbayOfferData {
  sku: string;
  price: number;
  quantity: number;
  condition: 'NEW' | 'USED_EXCELLENT' | 'USED_VERY_GOOD' | 'USED_GOOD' | 'USED_ACCEPTABLE';
  category_id?: string;
  title?: string;
  description?: string;
}

interface CreateListingRequest {
  product_id: string;
  tenant_id: string;
  connection_id: string;
  offer_data: EbayOfferData;
}

// Map condition to eBay condition enum
function mapCondition(condition: string): string {
  const mapping: Record<string, string> = {
    'NEW': 'NEW',
    'USED_EXCELLENT': 'USED_EXCELLENT',
    'USED_VERY_GOOD': 'USED_VERY_GOOD',
    'USED_GOOD': 'USED_GOOD',
    'USED_ACCEPTABLE': 'USED_ACCEPTABLE',
  };
  return mapping[condition] || 'NEW';
}

async function getAccessToken(credentials: {
  app_id: string;
  cert_id: string;
  refresh_token: string;
}): Promise<string> {
  const authString = btoa(`${credentials.app_id}:${credentials.cert_id}`);
  
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.refresh_token,
      scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('eBay OAuth error:', error);
    throw new Error('Failed to get eBay access token');
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product_id, tenant_id, connection_id, offer_data }: CreateListingRequest = await req.json();

    // Validate input
    if (!product_id || !tenant_id || !connection_id || !offer_data) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!offer_data.sku || offer_data.price <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'SKU and valid price are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get marketplace connection credentials
    const { data: connection, error: connectionError } = await supabase
      .from('marketplace_connections')
      .select('credentials, marketplace_id')
      .eq('id', connection_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (connectionError || !connection) {
      console.error('Connection error:', connectionError);
      return new Response(
        JSON.stringify({ success: false, error: 'eBay connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = connection.credentials as {
      ebayAppId?: string;
      ebayCertId?: string;
      ebayRefreshToken?: string;
      ebayMarketplaceId?: string;
    };

    if (!credentials.ebayAppId || !credentials.ebayCertId || !credentials.ebayRefreshToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Incomplete eBay credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ success: false, error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token
    const accessToken = await getAccessToken({
      app_id: credentials.ebayAppId,
      cert_id: credentials.ebayCertId,
      refresh_token: credentials.ebayRefreshToken,
    });

    const marketplaceId = credentials.ebayMarketplaceId || 'EBAY_NL';

    // Step 1: Create or update inventory item
    const inventoryItem = {
      product: {
        title: offer_data.title || product.name,
        description: offer_data.description || product.description || product.name,
        aspects: {},
        imageUrls: product.images || [],
      },
      condition: mapCondition(offer_data.condition),
      availability: {
        shipToLocationAvailability: {
          quantity: offer_data.quantity,
        },
      },
    };

    const inventoryResponse = await fetch(
      `${EBAY_API_URL}/sell/inventory/v1/inventory_item/${encodeURIComponent(offer_data.sku)}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Language': 'nl-NL',
          'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        },
        body: JSON.stringify(inventoryItem),
      }
    );

    if (!inventoryResponse.ok && inventoryResponse.status !== 204) {
      const error = await inventoryResponse.text();
      console.error('eBay inventory item error:', error);
      
      // Update product with error
      await supabase
        .from('products')
        .update({
          ebay_listing_status: 'error',
          ebay_listing_error: `Inventory item creation failed: ${error.substring(0, 200)}`,
        })
        .eq('id', product_id);
      
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create inventory item on eBay' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Create offer
    const offer = {
      sku: offer_data.sku,
      marketplaceId,
      format: 'FIXED_PRICE',
      availableQuantity: offer_data.quantity,
      pricingSummary: {
        price: {
          currency: 'EUR',
          value: offer_data.price.toFixed(2),
        },
      },
      listingPolicies: {
        // Default policies - merchants should configure these in eBay
      },
    };

    // Add category if provided
    if (offer_data.category_id) {
      (offer as Record<string, unknown>).categoryId = offer_data.category_id;
    }

    const offerResponse = await fetch(`${EBAY_API_URL}/sell/inventory/v1/offer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Language': 'nl-NL',
        'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
      },
      body: JSON.stringify(offer),
    });

    if (!offerResponse.ok) {
      const error = await offerResponse.text();
      console.error('eBay offer creation error:', error);
      
      // Update product with error
      await supabase
        .from('products')
        .update({
          ebay_listing_status: 'error',
          ebay_listing_error: `Offer creation failed: ${error.substring(0, 200)}`,
        })
        .eq('id', product_id);
      
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create offer on eBay' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const offerResult = await offerResponse.json();
    const offerId = offerResult.offerId;

    // Step 3: Publish the offer
    const publishResponse = await fetch(
      `${EBAY_API_URL}/sell/inventory/v1/offer/${offerId}/publish`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        },
      }
    );

    if (!publishResponse.ok) {
      const error = await publishResponse.text();
      console.error('eBay publish error:', error);
      
      // Update product with pending status (offer exists but not published)
      await supabase
        .from('products')
        .update({
          ebay_listing_status: 'pending',
          ebay_offer_id: offerId,
          ebay_listing_error: `Publish failed: ${error.substring(0, 200)}`,
        })
        .eq('id', product_id);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'pending',
          offer_id: offerId,
          message: 'Offer created but publish pending. Check listing policies on eBay.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const publishResult = await publishResponse.json();
    const listingId = publishResult.listingId;

    // Update product with success
    await supabase
      .from('products')
      .update({
        ebay_listing_status: 'listed',
        ebay_offer_id: offerId,
        ebay_item_id: listingId,
        ebay_last_synced_at: new Date().toISOString(),
        ebay_listing_error: null,
        ebay_optimized_title: offer_data.title || product.name,
        ebay_optimized_description: offer_data.description || product.description,
        ebay_condition: offer_data.condition,
        ebay_category_id: offer_data.category_id,
      })
      .eq('id', product_id);

    return new Response(
      JSON.stringify({
        success: true,
        status: 'listed',
        offer_id: offerId,
        item_id: listingId,
        message: 'Product successfully published to eBay',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error creating eBay listing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create eBay listing';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
