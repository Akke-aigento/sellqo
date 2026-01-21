import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOL_TOKEN_URL = 'https://login.bol.com/token?grant_type=client_credentials';
const BOL_API_URL = 'https://api.bol.com/retailer';

interface UpdateOfferRequest {
  product_id: string;
  tenant_id: string;
  connection_id: string;
  offer_id: string;
  update_type: 'price' | 'stock' | 'fulfilment' | 'all';
  update_data: {
    price?: number;
    stock?: number;
    delivery_code?: string;
    on_hold?: boolean;
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
    throw new Error('Failed to get Bol.com access token');
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

    const { product_id, tenant_id, connection_id, offer_id, update_type, update_data }: UpdateOfferRequest = await req.json();

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
    const accessToken = await getBolAccessToken(clientId, clientSecret);

    const results: Record<string, unknown> = {};
    let hasError = false;
    let errorMessage = '';

    // Update price
    if (update_type === 'price' || update_type === 'all') {
      if (update_data.price !== undefined) {
        const priceResponse = await fetch(`${BOL_API_URL}/offers/${offer_id}/price`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/vnd.retailer.v10+json',
            'Accept': 'application/vnd.retailer.v10+json',
          },
          body: JSON.stringify({
            pricing: {
              bundlePrices: [{
                quantity: 1,
                unitPrice: update_data.price,
              }],
            },
          }),
        });

        if (!priceResponse.ok) {
          hasError = true;
          errorMessage = `Price update failed: ${await priceResponse.text()}`;
        } else {
          results.price = 'updated';
        }
      }
    }

    // Update stock
    if (update_type === 'stock' || update_type === 'all') {
      if (update_data.stock !== undefined) {
        const stockResponse = await fetch(`${BOL_API_URL}/offers/${offer_id}/stock`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/vnd.retailer.v10+json',
            'Accept': 'application/vnd.retailer.v10+json',
          },
          body: JSON.stringify({
            amount: update_data.stock,
            managedByRetailer: true,
          }),
        });

        if (!stockResponse.ok) {
          hasError = true;
          errorMessage += ` Stock update failed: ${await stockResponse.text()}`;
        } else {
          results.stock = 'updated';
        }
      }
    }

    // Update fulfilment
    if (update_type === 'fulfilment' || update_type === 'all') {
      if (update_data.delivery_code) {
        const fulfilmentResponse = await fetch(`${BOL_API_URL}/offers/${offer_id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/vnd.retailer.v10+json',
            'Accept': 'application/vnd.retailer.v10+json',
          },
          body: JSON.stringify({
            onHoldByRetailer: update_data.on_hold ?? false,
            fulfilment: {
              method: 'FBR',
              deliveryCode: update_data.delivery_code,
            },
          }),
        });

        if (!fulfilmentResponse.ok) {
          hasError = true;
          errorMessage += ` Fulfilment update failed: ${await fulfilmentResponse.text()}`;
        } else {
          results.fulfilment = 'updated';
        }
      }
    }

    // Update product sync timestamp
    await supabase
      .from('products')
      .update({
        bol_last_synced_at: new Date().toISOString(),
        bol_listing_error: hasError ? errorMessage.substring(0, 500) : null,
      })
      .eq('id', product_id);

    return new Response(
      JSON.stringify({
        success: !hasError,
        results,
        error: hasError ? errorMessage : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error updating Bol.com offer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update offer';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
