import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
};

interface FulfillmentAPIKey {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  permissions: {
    read_orders: boolean;
    update_tracking: boolean;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract API key from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');

    // Validate API key
    const { data: keyData, error: keyError } = await supabase
      .from('fulfillment_api_keys')
      .select('id, tenant_id, name, is_active, permissions')
      .eq('api_key', apiKey)
      .single();

    if (keyError || !keyData) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fulfillmentKey = keyData as FulfillmentAPIKey;

    if (!fulfillmentKey.is_active) {
      return new Response(
        JSON.stringify({ error: 'API key is inactive' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_used_at
    await supabase
      .from('fulfillment_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', fulfillmentKey.id);

    // Parse URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Expected paths: 
    // /functions/v1/fulfillment-api/orders
    // /functions/v1/fulfillment-api/orders/:id/tracking
    // /functions/v1/fulfillment-api/orders/:id/shipped

    // Find the index of 'fulfillment-api' and work from there
    const apiIndex = pathParts.indexOf('fulfillment-api');
    const subPath = pathParts.slice(apiIndex + 1);

    // GET /orders - List orders pending fulfillment
    if (req.method === 'GET' && subPath[0] === 'orders' && !subPath[1]) {
      if (!fulfillmentKey.permissions.read_orders) {
        return new Response(
          JSON.stringify({ error: 'Permission denied: read_orders' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const status = url.searchParams.get('status') || 'unfulfilled';
      const limit = parseInt(url.searchParams.get('limit') || '50');

      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_name,
          shipping_address,
          fulfillment_status,
          carrier,
          tracking_number,
          tracking_url,
          marketplace_source,
          marketplace_order_id,
          created_at,
          order_items (
            id,
            product_name,
            product_sku,
            quantity
          )
        `)
        .eq('tenant_id', fulfillmentKey.tenant_id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status === 'unfulfilled') {
        query = query.or('fulfillment_status.is.null,fulfillment_status.eq.unfulfilled,fulfillment_status.eq.pending');
      } else if (status !== 'all') {
        query = query.eq('fulfillment_status', status);
      }

      const { data: orders, error } = await query;

      if (error) {
        console.error('Error fetching orders:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch orders' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: orders,
          count: orders?.length || 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /orders/:id/tracking - Update tracking info
    if (req.method === 'POST' && subPath[0] === 'orders' && subPath[2] === 'tracking') {
      if (!fulfillmentKey.permissions.update_tracking) {
        return new Response(
          JSON.stringify({ error: 'Permission denied: update_tracking' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const orderId = subPath[1];
      const body = await req.json();
      const { carrier, tracking_number, tracking_url } = body;

      if (!carrier || !tracking_number) {
        return new Response(
          JSON.stringify({ error: 'carrier and tracking_number are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify order belongs to tenant
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, tenant_id, order_number, marketplace_source')
        .eq('id', orderId)
        .eq('tenant_id', fulfillmentKey.tenant_id)
        .single();

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update order
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          carrier,
          tracking_number,
          tracking_url: tracking_url || null,
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('Error updating order:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Tracking updated',
          order_number: order.order_number
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /orders/:id/shipped - Mark as shipped
    if (req.method === 'POST' && subPath[0] === 'orders' && subPath[2] === 'shipped') {
      if (!fulfillmentKey.permissions.update_tracking) {
        return new Response(
          JSON.stringify({ error: 'Permission denied: update_tracking' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const orderId = subPath[1];
      const body = await req.json();
      const { carrier, tracking_number, tracking_url, notify_customer } = body;

      if (!carrier || !tracking_number) {
        return new Response(
          JSON.stringify({ error: 'carrier and tracking_number are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify order belongs to tenant
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, tenant_id, order_number, customer_email, customer_name, marketplace_source, marketplace_connection_id')
        .eq('id', orderId)
        .eq('tenant_id', fulfillmentKey.tenant_id)
        .single();

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update order as shipped
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          carrier,
          tracking_number,
          tracking_url: tracking_url || null,
          fulfillment_status: 'shipped',
          status: 'shipped',
          shipped_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('Error updating order:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Trigger marketplace sync if applicable
      if (order.marketplace_source === 'bol_com' && order.marketplace_connection_id) {
        try {
          await supabase.functions.invoke('confirm-bol-shipment', {
            body: {
              order_id: orderId,
              tracking_number,
              carrier,
              tracking_url,
            }
          });
        } catch (e) {
          console.error('Failed to sync to Bol.com:', e);
          // Don't fail the request, just log
        }
      }

      // Send customer notification if requested
      if (notify_customer && order.customer_email) {
        try {
          await supabase.functions.invoke('send-customer-message', {
            body: {
              tenant_id: fulfillmentKey.tenant_id,
              customer_email: order.customer_email,
              customer_name: order.customer_name,
              subject: `Je bestelling ${order.order_number} is onderweg! 📦`,
              body_html: generateFulfillmentShippingHtml(order.order_number, carrier, tracking_number, tracking_url),
              body_text: `Je bestelling ${order.order_number} is verzonden via ${carrier}. Tracknummer: ${tracking_number}`,
              context_type: 'order',
              order_id: orderId,
            }
          });
        } catch (e) {
          console.error('Failed to send notification:', e);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Order marked as shipped',
          order_number: order.order_number
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unknown endpoint
    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fulfillment API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
