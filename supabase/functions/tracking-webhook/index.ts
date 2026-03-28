import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Carrier name normalization map
const CARRIER_ALIASES: Record<string, string> = {
  // China carriers
  'china post': 'china_post',
  'chinapost': 'china_post',
  'china-post': 'china_post',
  'yanwen': 'yanwen',
  'yan wen': 'yanwen',
  'cainiao': 'cainiao',
  'aliexpress': 'cainiao',
  '4px': '4px',
  'epacket': 'epacket',
  'e-packet': 'epacket',
  'yunexpress': 'yunexpress',
  'yun express': 'yunexpress',
  'sf express': 'sf_express',
  'sfexpress': 'sf_express',
  '17track': '17track',
  // EU carriers
  'postnl': 'postnl',
  'post nl': 'postnl',
  'dhl': 'dhl',
  'dhl express': 'dhl',
  'dhl ecommerce': 'dhl_ecommerce',
  'dpd': 'dpd',
  'bpost': 'bpost',
  'gls': 'gls',
  'ups': 'ups',
  'fedex': 'fedex',
  // UK/US
  'royal mail': 'royal_mail',
  'royalmail': 'royal_mail',
  'usps': 'usps',
  'parcel force': 'parcel_force',
  'parcelforce': 'parcel_force',
};

function normalizeCarrier(carrier: string): string {
  if (!carrier) return 'other';
  const normalized = carrier.toLowerCase().trim().replace(/[-_\s]+/g, ' ');
  return CARRIER_ALIASES[normalized] || carrier.toLowerCase().replace(/\s+/g, '_');
}

interface TrackingPayload {
  api_key: string;
  order_reference: string;
  carrier?: string;
  tracking_number: string;
  tracking_url?: string;
  status?: 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception';
  shipped_at?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: TrackingPayload = await req.json();

    // Validate required fields
    if (!payload.api_key) {
      return new Response(JSON.stringify({ error: 'api_key is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!payload.order_reference) {
      return new Response(JSON.stringify({ error: 'order_reference is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!payload.tracking_number) {
      return new Response(JSON.stringify({ error: 'tracking_number is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate API key and get tenant
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('fulfillment_api_keys')
      .select('tenant_id, permissions, is_active')
      .eq('api_key', payload.api_key)
      .single();

    if (apiKeyError || !apiKeyData) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!apiKeyData.is_active) {
      return new Response(JSON.stringify({ error: 'API key is inactive' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenantId = apiKeyData.tenant_id;

    // Check permission
    const permissions = apiKeyData.permissions as Record<string, boolean> || {};
    if (!permissions.update_tracking) {
      return new Response(JSON.stringify({ error: 'API key does not have update_tracking permission' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find order using multi-field lookup
    const { data: orderId, error: lookupError } = await supabase
      .rpc('find_order_by_reference', {
        p_tenant_id: tenantId,
        p_reference: payload.order_reference,
      });

    if (lookupError || !orderId) {
      // Log failed import
      await supabase.from('tracking_import_log').insert({
        tenant_id: tenantId,
        import_source: 'webhook',
        total_records: 1,
        matched_records: 0,
        failed_records: 1,
        error_details: { order_reference: payload.order_reference, error: 'Order not found' },
      });

      return new Response(JSON.stringify({ 
        error: 'Order not found',
        order_reference: payload.order_reference,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current order data
    const { data: currentOrder, error: orderError } = await supabase
      .from('orders')
      .select('id, tracking_number, status')
      .eq('id', orderId)
      .single();

    if (orderError || !currentOrder) {
      return new Response(JSON.stringify({ error: 'Failed to fetch order' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for idempotency (same tracking number already set)
    if (currentOrder.tracking_number === payload.tracking_number) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Tracking already set (idempotent)',
        order_id: orderId,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize carrier
    const normalizedCarrier = normalizeCarrier(payload.carrier || 'other');

    // Prepare update data
    const updateData: Record<string, unknown> = {
      carrier: normalizedCarrier,
      tracking_number: payload.tracking_number,
      tracking_status: payload.status || 'shipped',
      last_tracking_check: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (payload.tracking_url) {
      updateData.tracking_url = payload.tracking_url;
    }

    if (payload.shipped_at) {
      updateData.shipped_at = payload.shipped_at;
    } else if (!currentOrder.status || currentOrder.status === 'pending' || currentOrder.status === 'processing') {
      updateData.shipped_at = new Date().toISOString();
    }

    // Update order status if not already shipped or beyond
    if (['pending', 'processing'].includes(currentOrder.status)) {
      updateData.status = 'shipped';
    }

    // Update the order
    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update order' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update API key last used timestamp
    await supabase
      .from('fulfillment_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('api_key', payload.api_key);

    // Log successful import
    await supabase.from('tracking_import_log').insert({
      tenant_id: tenantId,
      import_source: 'webhook',
      total_records: 1,
      matched_records: 1,
      failed_records: 0,
      import_data: {
        order_id: orderId,
        order_reference: payload.order_reference,
        carrier: normalizedCarrier,
        tracking_number: payload.tracking_number,
      },
    });

    // Get tracking settings to check if notification should be sent
    const { data: settings } = await supabase
      .from('tenant_tracking_settings')
      .select('notify_on_shipped')
      .eq('tenant_id', tenantId)
      .single();

    const shouldNotify = settings?.notify_on_shipped !== false; // Default true

    // Trigger customer notification if enabled
    if (shouldNotify && updateData.status === 'shipped') {
      try {
        await supabase.functions.invoke('send-customer-message', {
          body: {
            order_id: orderId,
            message_type: 'order_shipped',
          },
        });
      } catch (notifyError) {
        console.error('Notification error (non-fatal):', notifyError);
      }
    }

    // Sync to marketplace if applicable
    const { data: orderDetails } = await supabase
      .from('orders')
      .select('marketplace_source, marketplace_connection_id')
      .eq('id', orderId)
      .single();

    if (orderDetails?.marketplace_source === 'bol_com' && orderDetails?.marketplace_connection_id) {
      try {
        await supabase.functions.invoke('confirm-bol-shipment', {
          body: {
            order_id: orderId,
            tracking_number: payload.tracking_number,
            carrier: normalizedCarrier,
          },
        });
      } catch (syncError) {
        console.error('Marketplace sync error (non-fatal):', syncError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      order_id: orderId,
      carrier: normalizedCarrier,
      tracking_number: payload.tracking_number,
      status_updated: updateData.status === 'shipped',
      notification_sent: shouldNotify && updateData.status === 'shipped',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
