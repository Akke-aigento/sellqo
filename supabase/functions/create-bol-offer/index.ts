import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOL_TOKEN_URL = 'https://login.bol.com/token?grant_type=client_credentials';
const BOL_API_URL = 'https://api.bol.com/retailer';

interface CreateOfferRequest {
  product_id: string;
  tenant_id: string;
  connection_id: string;
  offer_data: {
    ean: string;
    condition: 'NEW' | 'AS_NEW' | 'GOOD' | 'REASONABLE' | 'MODERATE';
    price: number;
    stock: number;
    delivery_code: string;
    fulfilment_method: 'FBR' | 'FBB';
    title?: string; // For unknown products
  };
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { product_id, tenant_id, connection_id, offer_data }: CreateOfferRequest = await req.json();

    // Get marketplace connection credentials
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('credentials')
      .eq('id', connection_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Marketplace connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { clientId, clientSecret } = connection.credentials;
    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Invalid Bol.com credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token
    const accessToken = await getBolAccessToken(clientId, clientSecret);

    // Build offer payload
    const offerPayload = {
      ean: offer_data.ean,
      condition: {
        name: offer_data.condition,
      },
      reference: `SELLQO-${product_id}`,
      onHoldByRetailer: false,
      unknownProductTitle: offer_data.title || undefined,
      pricing: {
        bundlePrices: [{
          quantity: 1,
          unitPrice: offer_data.price,
        }],
      },
      stock: {
        amount: offer_data.stock,
        managedByRetailer: true,
      },
      fulfilment: {
        method: offer_data.fulfilment_method,
        deliveryCode: offer_data.delivery_code,
      },
    };

    // Create offer via Bol.com API
    const bolResponse = await fetch(`${BOL_API_URL}/offers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.retailer.v10+json',
        'Accept': 'application/vnd.retailer.v10+json',
      },
      body: JSON.stringify(offerPayload),
    });

    const responseText = await bolResponse.text();
    
    if (!bolResponse.ok) {
      console.error('Bol.com API error:', responseText);
      
      // Update product with error
      await supabase
        .from('products')
        .update({
          bol_listing_status: 'error',
          bol_listing_error: responseText.substring(0, 500),
        })
        .eq('id', product_id);

      return new Response(
        JSON.stringify({ 
          error: 'Failed to create Bol.com offer', 
          details: responseText 
        }),
        { status: bolResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse response - Bol.com returns a process status
    let bolData;
    try {
      bolData = JSON.parse(responseText);
    } catch {
      bolData = { processStatusId: 'unknown' };
    }

    // Update product with pending status (Bol.com processes offers async)
    await supabase
      .from('products')
      .update({
        bol_listing_status: 'pending',
        bol_offer_id: bolData.processStatusId,
        bol_listing_error: null,
        bol_last_synced_at: new Date().toISOString(),
        bol_ean: offer_data.ean,
        bol_delivery_code: offer_data.delivery_code,
        bol_condition: offer_data.condition,
        bol_fulfilment_method: offer_data.fulfilment_method,
      })
      .eq('id', product_id);

    return new Response(
      JSON.stringify({
        success: true,
        process_status_id: bolData.processStatusId,
        message: 'Offer submitted to Bol.com. Processing may take a few minutes.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error creating Bol.com offer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create offer';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
