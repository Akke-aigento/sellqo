import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EBAY_API_URL = 'https://api.ebay.com';

interface CheckStatusRequest {
  product_id: string;
  tenant_id: string;
  connection_id: string;
  offer_id: string;
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
      scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory',
    }),
  });

  if (!response.ok) {
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
    const { product_id, tenant_id, connection_id, offer_id }: CheckStatusRequest = await req.json();

    if (!product_id || !tenant_id || !connection_id || !offer_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
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
      .select('credentials')
      .eq('id', connection_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (connectionError || !connection) {
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

    // Get access token
    const accessToken = await getAccessToken({
      app_id: credentials.ebayAppId,
      cert_id: credentials.ebayCertId,
      refresh_token: credentials.ebayRefreshToken,
    });

    const marketplaceId = credentials.ebayMarketplaceId || 'EBAY_NL';

    // Get offer details
    const offerResponse = await fetch(
      `${EBAY_API_URL}/sell/inventory/v1/offer/${offer_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        },
      }
    );

    if (!offerResponse.ok) {
      const error = await offerResponse.text();
      console.error('eBay offer fetch error:', error);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch offer status',
          listing_status: 'error',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const offerData = await offerResponse.json();
    
    // Determine status based on offer state
    let listingStatus = 'pending';
    let itemId = null;
    let errorMessage = null;

    if (offerData.status === 'PUBLISHED') {
      listingStatus = 'listed';
      itemId = offerData.listing?.listingId;
    } else if (offerData.status === 'UNPUBLISHED') {
      listingStatus = 'pending';
    } else if (offerData.status === 'ENDED') {
      listingStatus = 'ended';
    }

    // Check for listing errors
    if (offerData.listingErrors && offerData.listingErrors.length > 0) {
      listingStatus = 'error';
      errorMessage = offerData.listingErrors.map((e: { message?: string }) => e.message).join('; ');
    }

    // Update product in database
    const updateData: Record<string, unknown> = {
      ebay_listing_status: listingStatus,
      ebay_last_synced_at: new Date().toISOString(),
    };

    if (itemId) {
      updateData.ebay_item_id = itemId;
    }

    if (errorMessage) {
      updateData.ebay_listing_error = errorMessage;
    } else {
      updateData.ebay_listing_error = null;
    }

    await supabase
      .from('products')
      .update(updateData)
      .eq('id', product_id);

    return new Response(
      JSON.stringify({
        success: true,
        listing_status: listingStatus,
        item_id: itemId,
        offer_status: offerData.status,
        error_message: errorMessage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error checking eBay listing status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to check status';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
