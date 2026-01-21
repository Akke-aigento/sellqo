import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOL_TOKEN_URL = 'https://login.bol.com/token?grant_type=client_credentials';
const BOL_API_URL = 'https://api.bol.com/retailer';

interface CheckStatusRequest {
  product_id: string;
  tenant_id: string;
  connection_id: string;
  process_status_id: string;
}

async function getBolAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch(BOL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Bol.com access token: ${error}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { product_id, tenant_id, connection_id, process_status_id }: CheckStatusRequest = await req.json();

    // Validate required fields
    if (!product_id || !tenant_id || !connection_id || !process_status_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get marketplace connection credentials
    const { data: connection, error: connectionError } = await supabase
      .from('marketplace_connections')
      .select('credentials')
      .eq('id', connection_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Marketplace connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { client_id, client_secret } = connection.credentials;

    // Get access token
    const accessToken = await getBolAccessToken(client_id, client_secret);

    // Check process status
    const statusResponse = await fetch(`${BOL_API_URL}/process-status/${process_status_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.retailer.v10+json',
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('Bol.com process status error:', errorText);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to check process status: ${statusResponse.status}`,
          details: errorText.substring(0, 500)
        }),
        { status: statusResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const statusData = await statusResponse.json();
    console.log('Process status response:', JSON.stringify(statusData));

    // Process status can be: PENDING, SUCCESS, FAILURE, TIMEOUT
    const processStatus = statusData.status;
    let newListingStatus = 'pending';
    let offerId: string | null = null;
    let errorMessage: string | null = null;

    if (processStatus === 'SUCCESS') {
      newListingStatus = 'listed';
      
      // Try to extract the offer ID from the links
      if (statusData.links) {
        const offerLink = statusData.links.find((link: any) => link.rel === 'self' && link.href?.includes('/offers/'));
        if (offerLink) {
          const match = offerLink.href.match(/\/offers\/([^/]+)/);
          if (match) {
            offerId = match[1];
          }
        }
      }
      
      // Also check entityId field
      if (!offerId && statusData.entityId) {
        offerId = statusData.entityId;
      }
    } else if (processStatus === 'FAILURE' || processStatus === 'TIMEOUT') {
      newListingStatus = 'error';
      errorMessage = statusData.errorMessage || `Process ${processStatus.toLowerCase()}`;
    }
    // PENDING status keeps the current 'pending' status

    // Update product with the result
    const updateData: Record<string, any> = {
      bol_listing_status: newListingStatus,
      bol_last_synced_at: new Date().toISOString(),
    };

    if (offerId) {
      updateData.bol_offer_id = offerId;
    }

    if (errorMessage) {
      updateData.bol_listing_error = errorMessage;
    } else if (newListingStatus === 'listed') {
      updateData.bol_listing_error = null;
    }

    const { error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', product_id)
      .eq('tenant_id', tenant_id);

    if (updateError) {
      console.error('Failed to update product:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update product status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: processStatus,
        listing_status: newListingStatus,
        offer_id: offerId,
        error_message: errorMessage,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Check Bol process status error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
