import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Inline Coolblue-style shipping email template (mirrors src/lib/shippingEmailTemplate.ts)
function generateFulfillmentShippingHtml(orderNumber: string, carrierName: string, trackingNumber: string, trackingUrl: string, primaryColor = '#7c3aed'): string {
  const dotActive = `display:inline-block;width:12px;height:12px;border-radius:50%;background:${primaryColor};vertical-align:middle;`;
  const dotInactive = `display:inline-block;width:12px;height:12px;border-radius:50%;background:#d1d5db;vertical-align:middle;`;
  const lblActive = `font-size:12px;color:#111827;font-weight:600;`;
  const lblInactive = `font-size:12px;color:#9ca3af;font-weight:400;`;

  return `
    <div style="text-align:center;padding:32px 24px 16px;">
      <div style="font-size:40px;line-height:1;">🎉</div>
      <h1 style="margin:12px 0 4px;font-size:24px;font-weight:700;color:#111827;">Joepie! Je pakket is onderweg!</h1>
      <p style="margin:0;font-size:15px;color:#6b7280;">Bestelling <strong>#${orderNumber}</strong> is verzonden</p>
    </div>
    <div style="padding:8px 24px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="text-align:center;width:25%;"><span style="${dotActive}">&nbsp;</span></td>
          <td style="text-align:center;width:25%;"><span style="${dotActive}">&nbsp;</span></td>
          <td style="text-align:center;width:25%;"><span style="${dotInactive}">&nbsp;</span></td>
          <td style="text-align:center;width:25%;"><span style="${dotInactive}">&nbsp;</span></td>
        </tr>
        <tr>
          <td style="padding-top:6px;text-align:center;"><span style="${lblActive}">Besteld</span></td>
          <td style="padding-top:6px;text-align:center;"><span style="${lblActive}">Verzonden</span></td>
          <td style="padding-top:6px;text-align:center;"><span style="${lblInactive}">Onderweg</span></td>
          <td style="padding-top:6px;text-align:center;"><span style="${lblInactive}">Bezorgd</span></td>
        </tr>
        <tr><td colspan="4" style="padding-top:4px;"><div style="height:4px;border-radius:2px;background:linear-gradient(90deg,${primaryColor} 0%,${primaryColor} 40%,#e5e7eb 40%,#e5e7eb 100%);"></div></td></tr>
      </table>
    </div>
    <div style="padding:0 24px 16px;">
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;background:#f9fafb;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;"><span style="font-size:24px;margin-right:8px;">🚚</span></td>
            <td style="vertical-align:middle;width:100%;">
              <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">${carrierName}</p>
              <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Tracknummer: <span style="font-family:monospace;font-weight:500;color:#374151;">${trackingNumber}</span></p>
            </td>
          </tr>
        </table>
      </div>
    </div>
    ${trackingUrl ? `<div style="padding:8px 24px 24px;text-align:center;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;"><tr><td style="background:${primaryColor};border-radius:12px;"><a href="${trackingUrl}" style="display:inline-block;padding:16px 40px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">📦&nbsp; Volg je pakket →</a></td></tr></table></div>` : ''}
    <div style="padding:0 24px 24px;"><div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;"><p style="margin:0;font-size:14px;color:#92400e;">💡 <strong>Tip:</strong> Houd je brievenbus in de gaten — het komt eraan!</p></div></div>
    <div style="text-align:center;padding:0 24px 8px;"><p style="margin:0;font-size:12px;color:#9ca3af;">📦 Betreft bestelling: <strong>#${orderNumber}</strong></p></div>
  `;
}

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
