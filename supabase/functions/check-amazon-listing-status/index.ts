import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  product_id: string;
  tenant_id: string;
  connection_id: string;
  sku: string;
}

// Get LWA access token for Amazon SP-API
async function getAmazonAccessToken(credentials: {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}): Promise<string> {
  const response = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.refresh_token,
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('LWA token error:', error);
    throw new Error(`Failed to get Amazon access token: ${response.status}`);
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
    const body: RequestBody = await req.json();
    const { product_id, tenant_id, connection_id, sku } = body;

    console.log('Checking Amazon listing status:', { product_id, sku });

    // Validate required fields
    if (!product_id || !tenant_id || !connection_id || !sku) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get marketplace connection credentials
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('credentials, settings')
      .eq('id', connection_id)
      .single();

    if (connError || !connection) {
      console.error('Connection not found:', connError);
      return new Response(
        JSON.stringify({ success: false, error: 'Marketplace connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = connection.credentials as {
      client_id: string;
      client_secret: string;
      refresh_token: string;
    };
    const settings = connection.settings as { marketplace_id?: string } || {};
    const marketplaceId = settings.marketplace_id || 'A1805IZSGTT6HS'; // Default: NL

    // Get access token
    let accessToken: string;
    try {
      accessToken = await getAmazonAccessToken(credentials);
    } catch (error) {
      console.error('Failed to get access token:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Amazon authenticatie mislukt. Controleer je API instellingen.' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check listing status via Listings API
    const endpoint = `https://sellingpartnerapi-eu.amazon.com/listings/2021-08-01/items/seller/${sku}`;
    const params = new URLSearchParams({
      marketplaceIds: marketplaceId,
      includedData: 'summaries,issues',
    });

    console.log('Calling Amazon Listings API:', `${endpoint}?${params}`);

    const listingResponse = await fetch(`${endpoint}?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    let listingStatus: string;
    let asin: string | null = null;
    let errorMessage: string | null = null;
    let issues: string[] = [];

    if (listingResponse.status === 404) {
      // Listing not found - might still be processing or failed
      listingStatus = 'pending';
      console.log('Listing not found, still processing');
    } else if (!listingResponse.ok) {
      const errorData = await listingResponse.text();
      console.error('Amazon API error:', errorData);
      listingStatus = 'error';
      errorMessage = `Amazon API fout: ${listingResponse.status}`;
    } else {
      const listingData = await listingResponse.json();
      console.log('Listing data received:', JSON.stringify(listingData, null, 2));

      // Check for issues
      if (listingData.issues && listingData.issues.length > 0) {
        issues = listingData.issues.map((issue: { severity: string; message: string }) => 
          `${issue.severity}: ${issue.message}`
        );
        
        // Check if there are error-level issues
        const hasErrors = listingData.issues.some((issue: { severity: string }) => 
          issue.severity === 'ERROR'
        );
        
        if (hasErrors) {
          listingStatus = 'error';
          errorMessage = issues.join('; ');
        } else {
          listingStatus = 'listed';
        }
      } else {
        listingStatus = 'listed';
      }

      // Extract ASIN from summaries
      if (listingData.summaries && listingData.summaries.length > 0) {
        asin = listingData.summaries[0].asin;
      }
    }

    console.log('Determined status:', { listingStatus, asin, errorMessage, issues });

    // Update product with status
    const updateData: Record<string, unknown> = {
      amazon_listing_status: listingStatus,
      amazon_last_synced_at: new Date().toISOString(),
    };

    if (asin) {
      updateData.amazon_asin = asin;
    }

    if (listingStatus === 'error' && errorMessage) {
      updateData.amazon_listing_error = errorMessage;
    } else if (listingStatus === 'listed') {
      updateData.amazon_listing_error = null;
    }

    const { error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', product_id);

    if (updateError) {
      console.error('Failed to update product:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        listing_status: listingStatus,
        asin,
        error_message: errorMessage,
        issues,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Check Amazon listing status error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
