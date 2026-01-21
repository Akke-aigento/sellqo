import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function mapWooOrderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'processing': 'processing',
    'on-hold': 'pending',
    'completed': 'shipped',
    'cancelled': 'cancelled',
    'refunded': 'cancelled',
    'failed': 'cancelled',
  }
  return statusMap[status] || 'pending'
}

function mapPaymentStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'processing': 'paid',
    'on-hold': 'pending',
    'completed': 'paid',
    'cancelled': 'cancelled',
    'refunded': 'refunded',
    'failed': 'failed',
  }
  return statusMap[status] || 'pending'
}

interface WooCommerceCredentials {
  siteUrl: string
  consumerKey: string
  consumerSecret: string
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
    const { connectionId, sinceDate } = await req.json()

    if (!connectionId) {
      throw new Error('connectionId is required')
    }

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) {
      throw new Error('Connection not found')
    }

    const credentials = connection.credentials as WooCommerceCredentials
    
    if (!credentials.siteUrl || !credentials.consumerKey || !credentials.consumerSecret) {
      throw new Error('Invalid WooCommerce credentials')
    }

    // Normalize site URL
    let siteUrl = credentials.siteUrl.trim()
    siteUrl = siteUrl.replace(/\/+$/, '')
    if (!siteUrl.startsWith('http')) {
      siteUrl = `https://${siteUrl}`
    }

    const authString = btoa(`${credentials.consumerKey}:${credentials.consumerSecret}`)

    // Calculate date range
    let afterDate = sinceDate || connection.last_sync_at
    if (!afterDate) {
      // Default to 90 days ago
      afterDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    }

    console.log(`Fetching WooCommerce orders since ${afterDate}`)

    // Fetch orders from WooCommerce
    const ordersUrl = `${siteUrl}/wp-json/wc/v3/orders?after=${afterDate}&per_page=100&orderby=date&order=asc`
    
    const response = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('WooCommerce API error:', response.status, errorText)
      throw new Error(`WooCommerce API error: ${response.status}`)
    }

    const orders = await response.json()
    console.log(`Found ${orders.length} WooCommerce orders`)

    let ordersImported = 0
    let ordersUpdated = 0

    for (const wooOrder of orders) {
      // Check if order already exists
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('tenant_id', connection.tenant_id)
        .eq('marketplace_order_id', wooOrder.id.toString())
        .eq('marketplace_source', 'woocommerce')
        .single()

      // Map line items
      const items = wooOrder.line_items?.map((item: any) => ({
        product_id: item.product_id?.toString(),
        variant_id: item.variation_id?.toString() || null,
        sku: item.sku || null,
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price || '0'),
        total: parseFloat(item.total || '0'),
      })) || []

      const orderData = {
        tenant_id: connection.tenant_id,
        marketplace_order_id: wooOrder.id.toString(),
        marketplace_source: 'woocommerce',
        order_number: `WC-${wooOrder.number || wooOrder.id}`,
        status: mapWooOrderStatus(wooOrder.status),
        payment_status: mapPaymentStatus(wooOrder.status),
        total: parseFloat(wooOrder.total || '0'),
        subtotal: parseFloat(wooOrder.subtotal || '0') + parseFloat(wooOrder.shipping_total || '0'),
        tax_amount: parseFloat(wooOrder.total_tax || '0'),
        shipping_cost: parseFloat(wooOrder.shipping_total || '0'),
        discount_amount: parseFloat(wooOrder.discount_total || '0'),
        currency: wooOrder.currency || 'EUR',
        customer_email: wooOrder.billing?.email || null,
        customer_name: `${wooOrder.billing?.first_name || ''} ${wooOrder.billing?.last_name || ''}`.trim() || null,
        shipping_street: wooOrder.shipping?.address_1 || null,
        shipping_city: wooOrder.shipping?.city || null,
        shipping_postal_code: wooOrder.shipping?.postcode || null,
        shipping_country: wooOrder.shipping?.country || null,
        billing_street: wooOrder.billing?.address_1 || null,
        billing_city: wooOrder.billing?.city || null,
        billing_postal_code: wooOrder.billing?.postcode || null,
        billing_country: wooOrder.billing?.country || null,
        items,
        notes: wooOrder.customer_note || null,
        sync_status: 'synced',
        created_at: wooOrder.date_created_gmt ? new Date(wooOrder.date_created_gmt + 'Z').toISOString() : new Date().toISOString(),
        updated_at: wooOrder.date_modified_gmt ? new Date(wooOrder.date_modified_gmt + 'Z').toISOString() : new Date().toISOString(),
      }

      if (existingOrder) {
        // Update existing order
        await supabase
          .from('orders')
          .update(orderData)
          .eq('id', existingOrder.id)
        ordersUpdated++
      } else {
        // Insert new order
        await supabase
          .from('orders')
          .insert(orderData)
        ordersImported++
      }
    }

    // Update last_sync_at on connection
    await supabase
      .from('marketplace_connections')
      .update({ 
        last_sync_at: new Date().toISOString(), 
        last_error: null 
      })
      .eq('id', connectionId)

    console.log(`WooCommerce sync complete: ${ordersImported} imported, ${ordersUpdated} updated`)

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error syncing WooCommerce orders:', errorMessage)
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
