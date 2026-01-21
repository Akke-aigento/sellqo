import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncRequest {
  connectionId: string
  sinceDate?: string
}

// Map Shopify fulfillment status to SellQo order status
function mapShopifyOrderStatus(
  financialStatus: string,
  fulfillmentStatus: string | null
): string {
  // Cancelled orders
  if (financialStatus === 'refunded' || financialStatus === 'voided') {
    return 'cancelled'
  }
  
  // Check fulfillment status
  if (fulfillmentStatus === 'fulfilled') {
    return 'shipped'
  }
  
  if (fulfillmentStatus === 'partial') {
    return 'processing'
  }
  
  // Pending payment
  if (financialStatus === 'pending' || financialStatus === 'authorized') {
    return 'pending'
  }
  
  // Paid but not fulfilled
  if (financialStatus === 'paid' && (!fulfillmentStatus || fulfillmentStatus === null)) {
    return 'processing'
  }
  
  return 'pending'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { connectionId, sinceDate } = await req.json() as SyncRequest

    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection ID is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get connection details
    const { data: connection, error: connectionError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (connectionError || !connection) {
      throw new Error('Marketplace verbinding niet gevonden')
    }

    const credentials = connection.credentials as { storeUrl: string; accessToken: string }
    const settings = connection.settings as { historicalPeriodDays?: number }
    
    // Normalize store URL
    let storeUrl = credentials.storeUrl.trim().toLowerCase()
    storeUrl = storeUrl.replace(/^https?:\/\//, '')
    storeUrl = storeUrl.replace(/\/+$/, '')

    // Calculate date range
    let createdAtMin: string
    if (sinceDate) {
      createdAtMin = sinceDate
    } else if (connection.last_sync_at) {
      // Get orders since last sync
      createdAtMin = connection.last_sync_at
    } else {
      // First sync - use historical period or default to 90 days
      const daysBack = settings?.historicalPeriodDays || 90
      const date = new Date()
      date.setDate(date.getDate() - daysBack)
      createdAtMin = date.toISOString()
    }

    console.log(`Syncing Shopify orders for store ${storeUrl} since ${createdAtMin}`)

    // Fetch orders from Shopify
    const ordersUrl = `https://${storeUrl}/admin/api/2024-01/orders.json?status=any&created_at_min=${encodeURIComponent(createdAtMin)}&limit=250`
    
    const response = await fetch(ordersUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': credentials.accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Shopify API error: ${response.status} - ${errorText}`)
    }

    const ordersData = await response.json()
    const orders = ordersData.orders || []

    console.log(`Found ${orders.length} orders from Shopify`)

    let ordersImported = 0
    let ordersUpdated = 0

    for (const shopifyOrder of orders) {
      // Check if order already exists
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('tenant_id', connection.tenant_id)
        .eq('marketplace_order_id', shopifyOrder.id.toString())
        .single()

      // Map Shopify order to SellQo format
      const orderData = {
        tenant_id: connection.tenant_id,
        marketplace_order_id: shopifyOrder.id.toString(),
        marketplace_type: 'shopify',
        order_number: shopifyOrder.order_number?.toString() || shopifyOrder.name,
        status: mapShopifyOrderStatus(shopifyOrder.financial_status, shopifyOrder.fulfillment_status),
        total_amount: parseFloat(shopifyOrder.total_price || '0'),
        subtotal: parseFloat(shopifyOrder.subtotal_price || '0'),
        tax_amount: parseFloat(shopifyOrder.total_tax || '0'),
        shipping_cost: parseFloat(shopifyOrder.total_shipping_price_set?.shop_money?.amount || '0'),
        discount_amount: parseFloat(shopifyOrder.total_discounts || '0'),
        currency: shopifyOrder.currency || 'EUR',
        customer_email: shopifyOrder.email,
        customer_name: shopifyOrder.customer 
          ? `${shopifyOrder.customer.first_name || ''} ${shopifyOrder.customer.last_name || ''}`.trim()
          : shopifyOrder.email,
        shipping_address: shopifyOrder.shipping_address ? {
          name: `${shopifyOrder.shipping_address.first_name || ''} ${shopifyOrder.shipping_address.last_name || ''}`.trim(),
          street: shopifyOrder.shipping_address.address1,
          street2: shopifyOrder.shipping_address.address2,
          city: shopifyOrder.shipping_address.city,
          postal_code: shopifyOrder.shipping_address.zip,
          country: shopifyOrder.shipping_address.country_code,
          phone: shopifyOrder.shipping_address.phone,
        } : null,
        billing_address: shopifyOrder.billing_address ? {
          name: `${shopifyOrder.billing_address.first_name || ''} ${shopifyOrder.billing_address.last_name || ''}`.trim(),
          street: shopifyOrder.billing_address.address1,
          street2: shopifyOrder.billing_address.address2,
          city: shopifyOrder.billing_address.city,
          postal_code: shopifyOrder.billing_address.zip,
          country: shopifyOrder.billing_address.country_code,
        } : null,
        items: shopifyOrder.line_items?.map((item: any) => ({
          product_id: item.product_id?.toString(),
          variant_id: item.variant_id?.toString(),
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          price: parseFloat(item.price || '0'),
          total: parseFloat(item.price || '0') * item.quantity,
        })) || [],
        notes: shopifyOrder.note,
        created_at: shopifyOrder.created_at,
        updated_at: shopifyOrder.updated_at,
      }

      if (existingOrder) {
        // Update existing order
        const { error: updateError } = await supabase
          .from('orders')
          .update(orderData)
          .eq('id', existingOrder.id)

        if (updateError) {
          console.error('Error updating order:', updateError)
        } else {
          ordersUpdated++
        }
      } else {
        // Insert new order
        const { error: insertError } = await supabase
          .from('orders')
          .insert(orderData)

        if (insertError) {
          console.error('Error inserting order:', insertError)
        } else {
          ordersImported++
        }
      }
    }

    // Update connection last_sync_at
    await supabase
      .from('marketplace_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', connectionId)

    console.log(`Sync complete: ${ordersImported} imported, ${ordersUpdated} updated`)

    return new Response(
      JSON.stringify({
        success: true,
        ordersImported,
        ordersUpdated,
        totalProcessed: orders.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Sync failed'
    console.error('Shopify order sync error:', errorMessage)

    // Update connection with error
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    const { connectionId } = await req.json().catch(() => ({ connectionId: null }))
    if (connectionId) {
      await supabase
        .from('marketplace_connections')
        .update({ last_error: errorMessage })
        .eq('id', connectionId)
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
