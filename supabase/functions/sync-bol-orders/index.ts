import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BOL_API_BASE = 'https://api.bol.com/retailer'
const BOL_TOKEN_URL = 'https://login.bol.com/token'

interface BolCredentials {
  clientId: string
  clientSecret: string
  accessToken?: string
  refreshToken?: string
  tokenExpiry?: string
}

interface BolOrder {
  orderId: string
  orderPlacedDateTime: string
  statusModification?: string
  orderItems: Array<{
    quantity: number
    offerPrice: number
    orderItemId: string
    ean: string
    title: string
  }>
  shipmentDetails?: {
    customerDetails?: {
      fullName: string
      email?: string
      deliveryPhoneNumber?: string
    }
    street?: string
    houseNumber?: string
    zipCode?: string
    city?: string
    countryCode?: string
  }
  billingDetails?: {
    street?: string
    houseNumber?: string
    zipCode?: string
    city?: string
    countryCode?: string
  }
}

async function getBolAccessToken(credentials: BolCredentials): Promise<string> {
  const { clientId, clientSecret, accessToken, tokenExpiry } = credentials

  // Check if we have a valid access token
  if (accessToken && tokenExpiry) {
    const expiry = new Date(tokenExpiry)
    if (expiry > new Date()) {
      return accessToken
    }
  }

  // Get a new token using client credentials
  const authString = btoa(`${clientId}:${clientSecret}`)
  
  const response = await fetch(BOL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authString}`,
      'Accept': 'application/json'
    },
    body: 'grant_type=client_credentials'
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Token request failed:', errorText)
    throw new Error(`Token request failed: ${response.statusText}`)
  }

  const tokenData = await response.json()
  return tokenData.access_token
}

function mapBolStatus(bolStatus: string | undefined): string {
  const statusMap: Record<string, string> = {
    'OPEN': 'processing',
    'SHIPPED': 'shipped',
    'CANCELLED': 'cancelled',
    'RETURNED': 'refunded'
  }
  return statusMap[bolStatus || 'OPEN'] || 'processing'
}

function mapBolPaymentStatus(bolStatus: string | undefined): string {
  // Bol.com orders are typically already paid
  return 'paid'
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting Bol.com order sync...')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Parse optional request body for specific connection
    const body = await req.json().catch(() => ({}))
    const { connectionId } = body

    // Build query for active Bol.com connections
    let query = supabase
      .from('marketplace_connections')
      .select('*')
      .eq('marketplace_type', 'bol_com')
      .eq('is_active', true)

    if (connectionId) {
      query = query.eq('id', connectionId)
    }

    const { data: connections, error: connError } = await query

    if (connError) {
      console.error('Error fetching connections:', connError)
      throw connError
    }

    console.log(`Found ${connections?.length || 0} active Bol.com connections`)

    let totalImported = 0
    let totalErrors = 0

    for (const connection of connections || []) {
      try {
        console.log(`Syncing connection: ${connection.id}`)

        const credentials = connection.credentials as BolCredentials
        const settings = connection.settings as Record<string, unknown> || {}
        const stats = (connection.stats as Record<string, unknown>) || {}
        
        // Get OAuth token
        const accessToken = await getBolAccessToken(credentials)
        console.log('Successfully obtained access token')

        // Determine if this is the first sync and if we should import historical orders
        const isFirstSync = !connection.last_sync_at
        const importHistorical = settings.importHistorical as boolean
        const historicalPeriodDays = (settings.historicalPeriodDays as number) || 90
        const historicalImportCompleted = stats.historicalImportCompleted as boolean

        let bolOrders: BolOrder[] = []

        if (isFirstSync && importHistorical && !historicalImportCompleted) {
          // First sync with historical import enabled
          console.log(`Performing historical import for the last ${historicalPeriodDays} days`)
          
          const startDate = new Date(Date.now() - historicalPeriodDays * 24 * 60 * 60 * 1000)
          const statuses = ['OPEN', 'SHIPPED', 'CANCELLED', 'RETURNED']
          const fulfillmentMethods = ['FBR', 'FBB'] // FBB = LVB (Logistiek via Bol)
          
          for (const fulfillmentMethod of fulfillmentMethods) {
            for (const status of statuses) {
              const url = `${BOL_API_BASE}/orders?fulfilment-method=${fulfillmentMethod}&status=${status}&created-after=${startDate.toISOString()}`
              console.log(`Fetching ${fulfillmentMethod} ${status} orders from: ${url}`)
              
              const ordersResponse = await fetch(url, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Accept': 'application/vnd.retailer.v10+json'
                }
              })

              if (!ordersResponse.ok) {
                const errorText = await ordersResponse.text()
                console.error(`Bol API error for ${fulfillmentMethod} ${status}:`, errorText)
                continue // Continue with other statuses/methods
              }

              const ordersData = await ordersResponse.json()
              const statusOrders: BolOrder[] = ordersData.orders || []
              console.log(`Found ${statusOrders.length} ${fulfillmentMethod} ${status} orders`)
              bolOrders = [...bolOrders, ...statusOrders]
            }
          }
          
          console.log(`Total historical orders found: ${bolOrders.length}`)
        } else {
          // Regular sync - fetch OPEN orders for both FBR and FBB (LVB)
          const fulfillmentMethods = ['FBR', 'FBB']
          
          for (const fulfillmentMethod of fulfillmentMethods) {
            const ordersResponse = await fetch(`${BOL_API_BASE}/orders?fulfilment-method=${fulfillmentMethod}&status=OPEN`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.retailer.v10+json'
              }
            })

            if (!ordersResponse.ok) {
              const errorText = await ordersResponse.text()
              console.error(`Bol API error for ${fulfillmentMethod}:`, errorText)
              continue // Continue with other fulfillment method
            }

            const ordersData = await ordersResponse.json()
            const methodOrders: BolOrder[] = ordersData.orders || []
            console.log(`Found ${methodOrders.length} open ${fulfillmentMethod} orders for connection ${connection.id}`)
            bolOrders = [...bolOrders, ...methodOrders]
          }
          
          console.log(`Total open orders found: ${bolOrders.length}`)
        }

        // Process each order
        for (const bolOrder of bolOrders) {
          try {
            // Check if order already exists
            const { data: existingOrder } = await supabase
              .from('orders')
              .select('id')
              .eq('marketplace_order_id', bolOrder.orderId)
              .eq('tenant_id', connection.tenant_id)
              .single()

            if (existingOrder) {
              console.log(`Order ${bolOrder.orderId} already exists, skipping`)
              continue
            }

            // Calculate total amount
            const subtotal = bolOrder.orderItems.reduce((sum, item) => {
              return sum + (item.quantity * item.offerPrice)
            }, 0)

            // Map Bol.com status to SellQo status
            const status = mapBolStatus(bolOrder.statusModification)
            const paymentStatus = mapBolPaymentStatus(bolOrder.statusModification)

            // Prepare shipping address
            const shippingAddress = bolOrder.shipmentDetails ? {
              street: `${bolOrder.shipmentDetails.street || ''} ${bolOrder.shipmentDetails.houseNumber || ''}`.trim(),
              city: bolOrder.shipmentDetails.city,
              postal_code: bolOrder.shipmentDetails.zipCode,
              country: bolOrder.shipmentDetails.countryCode
            } : null

            // Generate order number
            const { data: orderNumber } = await supabase.rpc('generate_order_number', {
              _tenant_id: connection.tenant_id
            })

            // Create order in SellQo
            const { data: newOrder, error: insertError } = await supabase
              .from('orders')
              .insert({
                tenant_id: connection.tenant_id,
                order_number: orderNumber,
                marketplace_source: 'bol_com',
                marketplace_order_id: bolOrder.orderId,
                marketplace_connection_id: connection.id,
                customer_name: bolOrder.shipmentDetails?.customerDetails?.fullName || 'Onbekend',
                customer_email: bolOrder.shipmentDetails?.customerDetails?.email || `bol-${bolOrder.orderId}@noreply.bol.com`,
                customer_phone: bolOrder.shipmentDetails?.customerDetails?.deliveryPhoneNumber,
                subtotal: subtotal,
                total: subtotal,
                status: status,
                payment_status: paymentStatus,
                fulfillment_status: 'unfulfilled',
                sync_status: 'synced',
                shipping_address: shippingAddress,
                raw_marketplace_data: bolOrder
              })
              .select()
              .single()

            if (insertError) {
              console.error(`Failed to insert order ${bolOrder.orderId}:`, insertError)
              totalErrors++
              continue
            }

            // Insert order items
            const orderItems = bolOrder.orderItems.map((item, index) => ({
              order_id: newOrder.id,
              product_name: item.title,
              product_sku: item.ean,
              quantity: item.quantity,
              unit_price: item.offerPrice,
              total_price: item.quantity * item.offerPrice
            }))

            const { error: itemsError } = await supabase
              .from('order_items')
              .insert(orderItems)

            if (itemsError) {
              console.error(`Failed to insert order items for ${bolOrder.orderId}:`, itemsError)
            }

            // Send marketplace order notification
            try {
              await supabase.functions.invoke('create-notification', {
                body: {
                  tenant_id: connection.tenant_id,
                  category: 'orders',
                  type: 'marketplace_order_new',
                  title: `Bol.com bestelling: ${orderNumber}`,
                  message: `Nieuwe Bol.com bestelling van €${subtotal.toFixed(2)} ontvangen`,
                  priority: 'medium',
                  action_url: `/admin/orders/${newOrder.id}`,
                  data: {
                    order_id: newOrder.id,
                    order_number: orderNumber,
                    marketplace_order_id: bolOrder.orderId,
                    marketplace: 'bol_com',
                    total: subtotal
                  }
                }
              })
            } catch (notificationError) {
              console.error('Failed to send marketplace notification:', notificationError)
              // Non-blocking - continue with sync
            }

            console.log(`Successfully imported order ${bolOrder.orderId}`)
            totalImported++

          } catch (orderError) {
            console.error(`Error processing order ${bolOrder.orderId}:`, orderError)
            totalErrors++
          }
        }

        // Update connection stats
        const currentStats = (connection.stats as Record<string, unknown>) || {}
        
        await supabase
          .from('marketplace_connections')
          .update({
            last_sync_at: new Date().toISOString(),
            last_error: null,
            stats: {
              ...currentStats,
              totalOrders: ((currentStats.totalOrders as number) || 0) + totalImported,
              lastSync: new Date().toISOString(),
              // Mark historical import as completed if this was a first sync with historical import
              ...(isFirstSync && importHistorical ? {
                historicalImportCompleted: true,
                historicalImportDate: new Date().toISOString()
              } : {})
            }
          })
          .eq('id', connection.id)

      } catch (connectionError) {
        const errorMessage = connectionError instanceof Error ? connectionError.message : 'Unknown error'
        console.error(`Sync failed for connection ${connection.id}:`, errorMessage)
        
        // Log error to connection
        await supabase
          .from('marketplace_connections')
          .update({
            last_error: errorMessage,
            last_sync_at: new Date().toISOString()
          })
          .eq('id', connection.id)
        
        totalErrors++
      }
    }

    const result = {
      success: true,
      connections_processed: connections?.length || 0,
      orders_imported: totalImported,
      errors: totalErrors
    }

    console.log('Sync completed:', result)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Fatal error in sync-bol-orders:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
