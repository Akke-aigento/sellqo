import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { order_id, connection_id, bol_order_id, order_items } = await req.json()

    if (!connection_id) {
      throw new Error('connection_id is required')
    }

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connection_id)
      .single()

    if (connError || !connection) {
      throw new Error(`Connection not found: ${connError?.message}`)
    }

    // Determine the Bol order ID and items
    let bolOrderId = bol_order_id
    let itemsToAccept = order_items

    // If order_id is provided, fetch order details from database
    if (order_id && !bol_order_id) {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('marketplace_order_id, raw_marketplace_data')
        .eq('id', order_id)
        .single()

      if (orderError || !order) {
        throw new Error(`Order not found: ${orderError?.message}`)
      }

      bolOrderId = order.marketplace_order_id
      
      // Extract order items from raw marketplace data
      const rawData = order.raw_marketplace_data as { orderItems?: Array<{ orderItemId: string, quantity: number }> }
      if (rawData?.orderItems) {
        itemsToAccept = rawData.orderItems.map(item => ({
          orderItemId: item.orderItemId,
          quantity: item.quantity
        }))
      }
    }

    if (!bolOrderId) {
      throw new Error('Could not determine Bol order ID')
    }

    if (!itemsToAccept || itemsToAccept.length === 0) {
      throw new Error('No order items to accept')
    }

    console.log(`Accepting Bol order ${bolOrderId} with ${itemsToAccept.length} items`)

    // Bol.com v10 API: There is no explicit "accept" endpoint.
    // Acceptance happens when a shipment is created (POST /retailer/shipments)
    // or when a VVB label is created (POST /retailer/shipping-labels).
    // This function marks the order locally as "accept_pending".
    // The actual acceptance at Bol.com happens via:
    // 1. VVB label creation (create-bol-vvb-label) → POST /retailer/shipping-labels
    // 2. Shipment confirmation (confirm-bol-shipment) → POST /retailer/shipments
    console.log('Bol.com v10: Marking order as accept_pending. Actual acceptance happens via VVB label + shipment creation.')
    
    if (order_id) {
      await supabase.from('orders').update({
        sync_status: 'accept_pending',
        updated_at: new Date().toISOString()
      }).eq('id', order_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order gemarkeerd als accept_pending. Acceptatie bij Bol.com gebeurt via VVB label + verzendbevestiging.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in accept-bol-order:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
