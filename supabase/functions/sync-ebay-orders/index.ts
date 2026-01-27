import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EbayCredentials {
  ebayAppId: string;
  ebayCertId: string;
  ebayRefreshToken: string;
  ebayMarketplaceId?: string;
}

interface EbayOrder {
  orderId: string;
  orderFulfillmentStatus: string;
  orderPaymentStatus: string;
  creationDate: string;
  buyer: {
    username: string;
    buyerRegistrationAddress?: {
      fullName?: string;
      email?: string;
      contactAddress?: {
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        stateOrProvince?: string;
        postalCode?: string;
        countryCode?: string;
      };
      primaryPhone?: { phoneNumber?: string };
    };
  };
  pricingSummary: {
    total: { value: string; currency: string };
  };
  lineItems: Array<{
    lineItemId: string;
    title: string;
    quantity: number;
    sku?: string;
    lineItemCost: { value: string; currency: string };
  }>;
  fulfillmentStartInstructions?: Array<{
    shippingStep?: {
      shipTo?: {
        fullName?: string;
        contactAddress?: {
          addressLine1?: string;
          addressLine2?: string;
          city?: string;
          stateOrProvince?: string;
          postalCode?: string;
          countryCode?: string;
        };
        primaryPhone?: { phoneNumber?: string };
        email?: string;
      };
    };
  }>;
}

async function getAccessToken(credentials: EbayCredentials): Promise<string> {
  const authString = btoa(`${credentials.ebayAppId}:${credentials.ebayCertId}`);
  
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authString}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.ebayRefreshToken,
      scope: 'https://api.ebay.com/oauth/api_scope/sell.fulfillment https://api.ebay.com/oauth/api_scope/sell.inventory',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`eBay token refresh failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

function mapEbayStatus(orderFulfillmentStatus: string, orderPaymentStatus: string): string {
  // Payment status check first
  if (orderPaymentStatus === 'PENDING' || orderPaymentStatus === 'FAILED') {
    return 'pending';
  }
  
  // Then fulfillment status
  switch (orderFulfillmentStatus) {
    case 'NOT_STARTED':
    case 'IN_PROGRESS':
      return 'processing';
    case 'FULFILLED':
      return 'shipped';
    default:
      return 'processing';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connectionId } = await req.json();
    
    if (!connectionId) {
      throw new Error('connectionId is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch connection details
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      throw new Error('Connection not found');
    }

    const credentials = connection.credentials as unknown as EbayCredentials;
    
    // Get access token
    const accessToken = await getAccessToken(credentials);
    
    // Determine date filter based on settings
    const settings = connection.settings || {};
    const daysBack = settings.importHistorical 
      ? (settings.historicalPeriodDays || 90)
      : 7;
    
    const filterDate = new Date();
    filterDate.setDate(filterDate.getDate() - daysBack);
    const filterDateStr = filterDate.toISOString();

    // Fetch orders from eBay
    const ordersResponse = await fetch(
      `https://api.ebay.com/sell/fulfillment/v1/order?filter=creationdate:[${filterDateStr}..]&limit=200`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': credentials.ebayMarketplaceId || 'EBAY_NL',
        },
      }
    );

    if (!ordersResponse.ok) {
      const error = await ordersResponse.text();
      throw new Error(`eBay orders fetch failed: ${error}`);
    }

    const ordersData = await ordersResponse.json();
    const orders: EbayOrder[] = ordersData.orders || [];
    
    let ordersImported = 0;
    let ordersSkipped = 0;

    for (const ebayOrder of orders) {
      // Check if order already exists
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('tenant_id', connection.tenant_id)
        .eq('marketplace_order_id', ebayOrder.orderId)
        .single();

      if (existingOrder) {
        ordersSkipped++;
        continue;
      }

      // Extract shipping address
      const shipTo = ebayOrder.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
      const buyerAddress = ebayOrder.buyer?.buyerRegistrationAddress;
      
      const shippingAddress = shipTo?.contactAddress || buyerAddress?.contactAddress;
      const shippingName = shipTo?.fullName || buyerAddress?.fullName || ebayOrder.buyer.username;
      const shippingEmail = shipTo?.email || buyerAddress?.email;
      const shippingPhone = shipTo?.primaryPhone?.phoneNumber || buyerAddress?.primaryPhone?.phoneNumber;

      // Map line items
      const items = ebayOrder.lineItems.map(item => ({
        sku: item.sku || '',
        name: item.title,
        quantity: item.quantity,
        price: parseFloat(item.lineItemCost.value),
        external_id: item.lineItemId,
      }));

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const total = parseFloat(ebayOrder.pricingSummary.total.value);

      // Create order
      const { error: orderError } = await supabase
        .from('orders')
        .insert({
          tenant_id: connection.tenant_id,
          marketplace_connection_id: connectionId,
          marketplace_type: 'ebay',
          marketplace_order_id: ebayOrder.orderId,
          external_reference: ebayOrder.orderId,
          status: mapEbayStatus(ebayOrder.orderFulfillmentStatus, ebayOrder.orderPaymentStatus),
          payment_status: ebayOrder.orderPaymentStatus === 'PAID' ? 'paid' : 'pending',
          items,
          subtotal,
          total,
          currency: ebayOrder.pricingSummary.total.currency || 'EUR',
          shipping_name: shippingName,
          shipping_email: shippingEmail,
          shipping_phone: shippingPhone,
          shipping_address: shippingAddress?.addressLine1,
          shipping_address_2: shippingAddress?.addressLine2,
          shipping_city: shippingAddress?.city,
          shipping_postal_code: shippingAddress?.postalCode,
          shipping_country: shippingAddress?.countryCode,
          order_date: ebayOrder.creationDate,
        });

      if (orderError) {
        console.error('Failed to import eBay order:', ebayOrder.orderId, orderError);
        continue;
      }

      ordersImported++;
    }

    // Update connection last sync
    await supabase
      .from('marketplace_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', connectionId);

    return new Response(
      JSON.stringify({
        success: true,
        ordersImported,
        ordersSkipped,
        totalFetched: orders.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('eBay order sync error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
