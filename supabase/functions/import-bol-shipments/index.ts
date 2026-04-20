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
  tokenExpiry?: string
}

interface ShipmentItem {
  orderItemId: string
  ean?: string
  title?: string
  quantity: number
  unitPrice?: number
  offerPrice?: number
  product?: {
    ean: string
    title: string
  }
}

interface ShipmentDetails {
  shipmentId: string
  orderId: string
  shipmentDateTime?: string
  shipmentReference?: string
  shipmentItems: ShipmentItem[]
  customerDetails?: {
    firstName?: string
    surname?: string
    email?: string
    deliveryPhoneNumber?: string
    streetName?: string
    houseNumber?: string
    houseNumberExtension?: string
    zipCode?: string
    city?: string
    countryCode?: string
  }
  billingDetails?: {
    firstName?: string
    surname?: string
    streetName?: string
    houseNumber?: string
    houseNumberExtension?: string
    zipCode?: string
    city?: string
    countryCode?: string
  }
  transport?: {
    transporterCode?: string
    trackAndTrace?: string
  }
}

interface ShipmentSummary {
  shipmentId: string
  shipmentDateTime?: string
  orderId?: string
}

async function getBolAccessToken(credentials: BolCredentials): Promise<string> {
  const { clientId, clientSecret, accessToken, tokenExpiry } = credentials

  if (accessToken && tokenExpiry) {
    const expiry = new Date(tokenExpiry)
    if (expiry > new Date()) {
      return accessToken
    }
  }

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

async function rateLimitDelay(ms: number = 200): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

// Fetch shipments list with pagination
async function fetchShipmentsWithPagination(
  accessToken: string,
  fulfillmentMethod: string
): Promise<ShipmentSummary[]> {
  const allShipments: ShipmentSummary[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const url = `${BOL_API_BASE}/shipments?fulfilment-method=${fulfillmentMethod}&page=${page}`
    console.log(`Fetching shipments page ${page}: ${url}`)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.retailer.v10+json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Bol API error for shipments ${fulfillmentMethod} page ${page}:`, errorText)
      break
    }

    const data = await response.json()
    const shipments: ShipmentSummary[] = data.shipments || []
    
    console.log(`Page ${page}: Found ${shipments.length} shipments`)
    allShipments.push(...shipments)

    // Bol.com returns max 50 shipments per page
    hasMore = shipments.length === 50
    page++

    if (hasMore) {
      await rateLimitDelay(300)
    }
  }

  return allShipments
}

// Fetch full shipment details
async function fetchShipmentDetails(
  shipmentId: string,
  accessToken: string
): Promise<ShipmentDetails | null> {
  try {
    const response = await fetch(`${BOL_API_BASE}/shipments/${shipmentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.retailer.v10+json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Failed to fetch shipment details for ${shipmentId}:`, errorText)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error(`Error fetching shipment ${shipmentId}:`, error)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting Bol.com shipments import...')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json().catch(() => ({}))
    const { connectionId } = body

    if (!connectionId) {
      throw new Error('connectionId is required')
    }

    // Fetch the connection
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('marketplace_type', 'bol_com')
      .eq('is_active', true)
      .single()

    if (connError || !connection) {
      throw new Error(`Connection not found: ${connError?.message}`)
    }

    console.log(`Importing shipments for connection: ${connection.id}`)

    const credentials = connection.credentials as BolCredentials
    const accessToken = await getBolAccessToken(credentials)
    console.log('Successfully obtained access token')

    // Load tenant VAT rate for tax calculation on incoming orders
    const { data: tenantForTax } = await supabase
      .from('tenants')
      .select('tax_percentage, default_vat_rate')
      .eq('id', connection.tenant_id)
      .single()
    const vatRate = Number(tenantForTax?.tax_percentage ?? tenantForTax?.default_vat_rate ?? 21)

    // Fetch all shipments for both FBR and FBB
    let allShipments: ShipmentSummary[] = []
    const fulfillmentMethods = ['FBR', 'FBB']

    for (const method of fulfillmentMethods) {
      console.log(`Fetching ${method} shipments...`)
      const shipments = await fetchShipmentsWithPagination(accessToken, method)
      console.log(`Found ${shipments.length} ${method} shipments`)
      allShipments.push(...shipments)
      await rateLimitDelay(500)
    }

    // Deduplicate by shipmentId
    const uniqueShipmentIds = [...new Set(allShipments.map(s => s.shipmentId))]
    console.log(`Total unique shipments to process: ${uniqueShipmentIds.length}`)

    let totalImported = 0
    let totalSkipped = 0
    let totalErrors = 0

    // Track which orderIds we've already processed in this run
    const processedOrderIds = new Set<string>()

    for (const shipmentId of uniqueShipmentIds) {
      try {
        // Fetch full shipment details
        console.log(`Fetching details for shipment ${shipmentId}...`)
        const shipment = await fetchShipmentDetails(shipmentId, accessToken)
        
        if (!shipment) {
          console.error(`Could not fetch details for shipment ${shipmentId}`)
          totalErrors++
          await rateLimitDelay(200)
          continue
        }

        const orderId = shipment.orderId
        if (!orderId) {
          console.log(`Shipment ${shipmentId} has no orderId, skipping`)
          totalSkipped++
          continue
        }

        // Skip if we already processed this order in this run
        if (processedOrderIds.has(orderId)) {
          console.log(`Order ${orderId} already processed in this run, skipping shipment ${shipmentId}`)
          totalSkipped++
          continue
        }

        // Check if order already exists in database
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('marketplace_order_id', orderId)
          .eq('tenant_id', connection.tenant_id)
          .single()

        if (existingOrder) {
          console.log(`Order ${orderId} already exists, skipping`)
          processedOrderIds.add(orderId)
          totalSkipped++
          continue
        }

        // Calculate totals from shipment items
        const subtotal = (shipment.shipmentItems || []).reduce((sum, item) => {
          const price = item.unitPrice ?? item.offerPrice ?? 0
          return sum + (item.quantity * price)
        }, 0)

        const safeSubtotal = typeof subtotal === 'number' && !isNaN(subtotal) ? subtotal : 0

        // Prepare shipping address
        const customer = shipment.customerDetails
        const shippingAddress = customer ? {
          street: `${customer.streetName || ''} ${customer.houseNumber || ''} ${customer.houseNumberExtension || ''}`.trim(),
          city: customer.city,
          postal_code: customer.zipCode,
          country: customer.countryCode
        } : null

        const customerName = customer 
          ? `${customer.firstName || ''} ${customer.surname || ''}`.trim() || 'Onbekend'
          : 'Onbekend'

        // Generate order number
        const { data: orderNumber } = await supabase.rpc('generate_order_number', {
          _tenant_id: connection.tenant_id
        })

        // Prepare tracking info
        const trackingNumber = shipment.transport?.trackAndTrace || null
        const carrier = shipment.transport?.transporterCode || null

        // Create order in SellQo with shipped status
        const { data: newOrder, error: insertError } = await supabase
          .from('orders')
          .insert({
            tenant_id: connection.tenant_id,
            order_number: orderNumber,
            marketplace_source: 'bol_com',
            marketplace_order_id: orderId,
            marketplace_connection_id: connection.id,
            customer_name: customerName,
            customer_email: customer?.email || `bol-${orderId}@noreply.bol.com`,
            customer_phone: customer?.deliveryPhoneNumber,
            subtotal: safeSubtotal,
            total: safeSubtotal,
            tax_amount: vatRate > 0
              ? Math.round(safeSubtotal * (vatRate / (100 + vatRate)) * 100) / 100
              : 0,
            status: 'shipped', // Shipments are already shipped
            payment_status: 'paid', // Bol.com orders are prepaid
            fulfillment_status: 'fulfilled',
            sync_status: 'synced',
            shipping_address: shippingAddress,
            tracking_number: trackingNumber,
            carrier: carrier,
            shipped_at: shipment.shipmentDateTime || new Date().toISOString(),
            raw_marketplace_data: shipment
          })
          .select()
          .single()

        if (insertError) {
          console.error(`Failed to insert order ${orderId}:`, insertError)
          totalErrors++
          await rateLimitDelay(200)
          continue
        }

        // Insert order items
        const orderItems = (shipment.shipmentItems || []).map((item) => ({
          order_id: newOrder.id,
          product_name: item.title || item.product?.title || `EAN: ${item.ean || item.product?.ean || 'Unknown'}`,
          product_sku: item.ean || item.product?.ean,
          quantity: item.quantity,
          unit_price: item.unitPrice ?? item.offerPrice ?? 0,
          total_price: item.quantity * (item.unitPrice ?? item.offerPrice ?? 0)
        }))

        if (orderItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems)

          if (itemsError) {
            console.error(`Failed to insert order items for ${orderId}:`, itemsError)
          }
        }

        console.log(`Successfully imported order ${orderId} from shipment ${shipmentId} (${customerName}, €${safeSubtotal.toFixed(2)})`)
        processedOrderIds.add(orderId)
        totalImported++

        await rateLimitDelay(200)

      } catch (shipmentError) {
        console.error(`Error processing shipment ${shipmentId}:`, shipmentError)
        totalErrors++
        await rateLimitDelay(200)
      }
    }

    // Update connection stats
    const currentStats = (connection.stats as Record<string, unknown>) || {}
    await supabase
      .from('marketplace_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        stats: {
          ...currentStats,
          shipmentsImportCompleted: true,
          lastShipmentsImport: new Date().toISOString(),
          totalOrders: (currentStats.totalOrders as number || 0) + totalImported
        }
      })
      .eq('id', connection.id)

    // Log sync activity
    await supabase
      .from('sync_activity_log')
      .insert({
        tenant_id: connection.tenant_id,
        connection_id: connection.id,
        data_type: 'orders',
        direction: 'inbound',
        status: totalErrors > 0 ? 'partial' : 'success',
        records_processed: uniqueShipmentIds.length,
        records_created: totalImported,
        records_updated: 0,
        records_failed: totalErrors,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })

    console.log(`Shipments import complete: ${totalImported} imported, ${totalSkipped} skipped, ${totalErrors} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        ordersImported: totalImported,
        ordersSkipped: totalSkipped,
        errors: totalErrors,
        message: `${totalImported} orders geïmporteerd via shipments (${totalSkipped} overgeslagen, ${totalErrors} fouten)`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in import-bol-shipments:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
