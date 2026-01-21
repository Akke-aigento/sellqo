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
  sinceDate?: string;
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

function mapAmazonOrderStatus(amazonStatus: string): string {
  const statusMap: Record<string, string> = {
    'Pending': 'pending',
    'Unshipped': 'processing',
    'PartiallyShipped': 'processing',
    'Shipped': 'shipped',
    'Canceled': 'cancelled',
    'Unfulfillable': 'cancelled',
  };
  return statusMap[amazonStatus] || 'pending';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { connectionId, sinceDate }: SyncRequest = await req.json();

    console.log('Syncing Amazon orders for connection:', connectionId);

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

    const { clientId, clientSecret, refreshToken, marketplaceId = 'nl' } = connection.credentials;
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

    // Calculate date range for orders
    const createdAfter = sinceDate 
      ? new Date(sinceDate) 
      : new Date(Date.now() - (connection.settings?.historicalPeriodDays || 90) * 24 * 60 * 60 * 1000);

    // Fetch orders from Amazon SP-API
    const ordersUrl = new URL(`https://${marketplace.endpoint}/orders/v0/orders`);
    ordersUrl.searchParams.append('MarketplaceIds', marketplace.id);
    ordersUrl.searchParams.append('CreatedAfter', createdAfter.toISOString());
    ordersUrl.searchParams.append('OrderStatuses', 'Unshipped,PartiallyShipped,Shipped');

    const ordersResponse = await fetch(ordersUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.error('Amazon Orders API error:', errorText);
      
      // Update connection with error
      await supabase
        .from('marketplace_connections')
        .update({ 
          last_error: `Order sync failed: ${errorText.substring(0, 200)}`,
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', connectionId);

      return new Response(
        JSON.stringify({ error: 'Failed to fetch Amazon orders', details: errorText }),
        { status: ordersResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ordersData = await ordersResponse.json();
    const amazonOrders = ordersData.payload?.Orders || [];
    
    let ordersImported = 0;
    let ordersUpdated = 0;

    for (const amazonOrder of amazonOrders) {
      try {
        const amazonOrderId = amazonOrder.AmazonOrderId;
        
        // Check if order already exists
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('marketplace_order_id', amazonOrderId)
          .eq('tenant_id', tenantId)
          .single();

        const shippingAddress = amazonOrder.ShippingAddress || {};
        
        const orderData = {
          tenant_id: tenantId,
          marketplace_order_id: amazonOrderId,
          marketplace_source: 'amazon',
          status: mapAmazonOrderStatus(amazonOrder.OrderStatus),
          order_date: amazonOrder.PurchaseDate,
          total_price: parseFloat(amazonOrder.OrderTotal?.Amount || '0'),
          shipping_address_line1: shippingAddress.AddressLine1 || '',
          shipping_address_line2: shippingAddress.AddressLine2 || null,
          shipping_city: shippingAddress.City || '',
          shipping_postal_code: shippingAddress.PostalCode || '',
          shipping_country: shippingAddress.CountryCode || 'NL',
          sync_status: 'synced',
          customer_email: amazonOrder.BuyerEmail || null,
        };

        if (existingOrder) {
          // Update existing order
          await supabase
            .from('orders')
            .update(orderData)
            .eq('id', existingOrder.id);
          ordersUpdated++;
        } else {
          // Insert new order
          const { data: newOrder } = await supabase
            .from('orders')
            .insert([orderData])
            .select('id')
            .single();

          if (newOrder) {
            // Fetch order items (requires separate API call)
            // This is simplified - full implementation would fetch order items
            ordersImported++;
          }
        }
      } catch (orderError) {
        console.error('Error processing Amazon order:', amazonOrder.AmazonOrderId, orderError);
      }
    }

    // Update connection stats
    await supabase
      .from('marketplace_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: null,
        stats: {
          totalOrders: ordersImported + ordersUpdated,
          lastOrderDate: amazonOrders[0]?.PurchaseDate || null,
        },
      })
      .eq('id', connectionId);

    return new Response(
      JSON.stringify({
        success: true,
        ordersImported,
        ordersUpdated,
        totalProcessed: amazonOrders.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error syncing Amazon orders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync orders';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
