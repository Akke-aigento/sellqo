import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

// Updated interface to match actual Bol.com API v10 response structure
interface BolOrderItem {
  orderItemId: string
  ean?: string
  quantity: number
  unitPrice: number // Bol.com uses unitPrice, not offerPrice
  offerPrice?: number // Fallback for older responses
  commission?: number
  product?: {
    ean: string
    title: string
  }
  fulfilment?: {
    method: 'FBR' | 'FBB'
    distributionParty?: string
  }
  cancellationRequest?: boolean
}

interface BolOrder {
  orderId: string
  orderPlacedDateTime: string
  pickupPoint?: boolean
  orderItems: BolOrderItem[]
  shipmentDetails?: {
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
}

// Order summary from list endpoint (minimal data)
interface BolOrderSummary {
  orderId: string
  orderPlacedDateTime?: string
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

function mapBolOrderStatus(orderItems: BolOrderItem[]): string {
  // Check if any items are cancelled
  const allCancelled = orderItems.every(item => item.cancellationRequest)
  if (allCancelled) return 'cancelled'
  
  // Check fulfilment status
  // Note: We infer status from the API endpoint we're fetching from
  // OPEN = processing, SHIPPED = shipped
  return 'processing'
}

function mapBolPaymentStatus(): string {
  // Bol.com orders are typically already paid
  return 'paid'
}

// Helper to add rate limiting delay
async function rateLimitDelay(ms: number = 200): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

// Fetch full order details from Bol.com
async function fetchOrderDetails(
  orderId: string, 
  accessToken: string
): Promise<BolOrder | null> {
  try {
    const response = await fetch(`${BOL_API_BASE}/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.retailer.v10+json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Failed to fetch order details for ${orderId}:`, errorText)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error(`Error fetching order ${orderId}:`, error)
    return null
  }
}

// Fetch orders with pagination support
async function fetchOrdersWithPagination(
  accessToken: string,
  fulfillmentMethod: string,
  status: string,
  startDate?: Date
): Promise<BolOrderSummary[]> {
  const allOrders: BolOrderSummary[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    let url = `${BOL_API_BASE}/orders?fulfilment-method=${fulfillmentMethod}&status=${status}&page=${page}`
    
    if (startDate) {
      url += `&created-after=${startDate.toISOString()}`
    }

    console.log(`Fetching page ${page}: ${url}`)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.retailer.v10+json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Bol API error for ${fulfillmentMethod} ${status} page ${page}:`, errorText)
      break
    }

    const data = await response.json()
    const orders: BolOrderSummary[] = data.orders || []
    
    console.log(`Page ${page}: Found ${orders.length} orders`)
    allOrders.push(...orders)

    // Bol.com returns max 50 orders per page
    hasMore = orders.length === 50
    page++

    // Rate limiting between pages
    if (hasMore) {
      await rateLimitDelay(300)
    }
  }

  return allOrders
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
    const { connectionId, forceHistoricalImport, historicalPeriodDays: requestedHistoricalDays } = body

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

        let orderSummaries: BolOrderSummary[] = []
        const fulfillmentMethods = ['FBR', 'FBB'] // FBB = LVB (Logistiek via Bol)

        // Determine if we should perform a historical import
        // - forceHistoricalImport: explicit request to import all historical orders
        // - First sync with importHistorical enabled and not yet completed
        const shouldPerformHistoricalImport = 
          forceHistoricalImport || 
          (isFirstSync && importHistorical && !historicalImportCompleted)

        if (shouldPerformHistoricalImport) {
          // Use requested days from body, or fallback to connection settings
          const effectiveHistoricalDays = requestedHistoricalDays || historicalPeriodDays
          console.log(`Performing historical import for the last ${effectiveHistoricalDays} days (forced: ${!!forceHistoricalImport})`)
          
          const startDate = new Date(Date.now() - effectiveHistoricalDays * 24 * 60 * 60 * 1000)
          
          // IMPORTANT: Bol.com API v10 only accepts: OPEN, SHIPPED, ALL
          // Use ALL for historical import to get all orders including completed ones
          for (const fulfillmentMethod of fulfillmentMethods) {
            console.log(`Fetching ALL ${fulfillmentMethod} orders since ${startDate.toISOString()}`)
            
            const orders = await fetchOrdersWithPagination(
              accessToken,
              fulfillmentMethod,
              'ALL', // Use ALL for complete historical import
              startDate
            )
            
            console.log(`Found ${orders.length} ${fulfillmentMethod} orders`)
            orderSummaries.push(...orders)
            
            // Rate limiting between fulfillment methods
            await rateLimitDelay(500)
          }
          
          console.log(`Total historical order summaries found: ${orderSummaries.length}`)
        } else {
          // Regular sync - fetch OPEN orders for both FBR and FBB (LVB)
          for (const fulfillmentMethod of fulfillmentMethods) {
            const orders = await fetchOrdersWithPagination(
              accessToken,
              fulfillmentMethod,
              'OPEN'
            )
            
            console.log(`Found ${orders.length} open ${fulfillmentMethod} orders`)
            orderSummaries.push(...orders)
            
            await rateLimitDelay(300)
          }
          
          console.log(`Total open order summaries found: ${orderSummaries.length}`)
        }

        // Deduplicate orders by orderId (in case same order appears in multiple queries)
        const uniqueOrderIds = [...new Set(orderSummaries.map(o => o.orderId))]
        console.log(`Unique orders to process: ${uniqueOrderIds.length}`)

        // Now fetch full details for each order
        let processedCount = 0
        for (const orderId of uniqueOrderIds) {
          try {
            // Check if order already exists
            const { data: existingOrder } = await supabase
              .from('orders')
              .select('id')
              .eq('marketplace_order_id', orderId)
              .eq('tenant_id', connection.tenant_id)
              .single()

            if (existingOrder) {
              console.log(`Order ${orderId} already exists, skipping`)
              continue
            }

            // Fetch full order details from Bol.com
            console.log(`Fetching details for order ${orderId}...`)
            const bolOrder = await fetchOrderDetails(orderId, accessToken)
            
            if (!bolOrder) {
              console.error(`Could not fetch details for order ${orderId}`)
              totalErrors++
              await rateLimitDelay(200)
              continue
            }

            // Calculate total amount from order items
            // Bol.com API v10 uses unitPrice, fallback to offerPrice for compatibility
            const subtotal = (bolOrder.orderItems || []).reduce((sum, item) => {
              const price = item.unitPrice ?? item.offerPrice ?? 0
              return sum + (item.quantity * price)
            }, 0) || 0 // Ensure never null

            // Ensure we have a valid subtotal (fallback to 0 if calculation fails)
            const safeSubtotal = typeof subtotal === 'number' && !isNaN(subtotal) ? subtotal : 0

            // Map status based on order items
            const status = mapBolOrderStatus(bolOrder.orderItems || [])
            const paymentStatus = mapBolPaymentStatus()

            // Prepare shipping address - use correct Bol.com field names
            const shipment = bolOrder.shipmentDetails
            const shippingAddress = shipment ? {
              street: `${shipment.streetName || ''} ${shipment.houseNumber || ''} ${shipment.houseNumberExtension || ''}`.trim(),
              city: shipment.city,
              postal_code: shipment.zipCode,
              country: shipment.countryCode
            } : null

            // Build customer name from shipment details
            const customerName = shipment 
              ? `${shipment.firstName || ''} ${shipment.surname || ''}`.trim() || 'Onbekend'
              : 'Onbekend'

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
                customer_name: customerName,
                customer_email: shipment?.email || `bol-${bolOrder.orderId}@noreply.bol.com`,
                customer_phone: shipment?.deliveryPhoneNumber,
                subtotal: safeSubtotal,
                total: safeSubtotal,
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
              await rateLimitDelay(200)
              continue
            }

            // Insert order items
            const orderItems = (bolOrder.orderItems || []).map((item) => ({
              order_id: newOrder.id,
              marketplace_order_item_id: item.orderItemId,
              product_name: item.product?.title || `EAN: ${item.ean || item.product?.ean || 'Unknown'}`,
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
                console.error(`Failed to insert order items for ${bolOrder.orderId}:`, itemsError)
              }
            }

            // Send marketplace order notification
            try {
              await supabase.functions.invoke('create-notification', {
                body: {
                  tenant_id: connection.tenant_id,
                  category: 'orders',
                  type: 'marketplace_order_new',
                  title: `Bol.com bestelling: ${orderNumber}`,
                  message: `Nieuwe Bol.com bestelling van €${safeSubtotal.toFixed(2)} ontvangen`,
                  priority: 'medium',
                  action_url: `/admin/orders/${newOrder.id}`,
                  data: {
                    order_id: newOrder.id,
                    order_number: orderNumber,
                    marketplace_order_id: bolOrder.orderId,
                    marketplace: 'bol_com',
                    total: safeSubtotal
                  }
                }
              })
            } catch (notificationError) {
              console.error('Failed to send marketplace notification:', notificationError)
              // Non-blocking - continue with sync
            }

            console.log(`Successfully imported order ${bolOrder.orderId} (${customerName}, €${safeSubtotal.toFixed(2)})`)
            totalImported++
            processedCount++

            // Auto-accept order — Bol.com has no accept endpoint, orders are auto-accepted
            // We just set sync_status = 'accepted' directly in the database
            const autoAcceptOrder = settings.autoAcceptOrder as boolean
            if (autoAcceptOrder && newOrder) {
              try {
                console.log(`Marking order ${bolOrder.orderId} as accepted (Bol.com auto-accepts orders)...`)
                
                await supabase
                  .from('orders')
                  .update({
                    sync_status: 'accepted',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', newOrder.id)

                console.log(`Order ${bolOrder.orderId} marked as accepted`)
                
                // Auto-create VVB label if enabled
                const vvbEnabled = settings.vvbEnabled as boolean
                if (vvbEnabled) {
                  try {
                    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
                    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
                    const vvbCarrier = (settings.vvbDefaultCarrier as string) || 'POSTNL'
                    console.log(`Auto-creating VVB label for order ${bolOrder.orderId} with carrier ${vvbCarrier}...`)
                    
                    const vvbRes = await fetch(`${supabaseUrl}/functions/v1/create-bol-vvb-label`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${serviceKey}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        order_id: newOrder.id,
                        carrier: vvbCarrier
                      })
                    })
                    const vvbBody = await vvbRes.text()
                    
                    if (vvbRes.ok) {
                      console.log(`VVB label created for order ${bolOrder.orderId}: ${vvbBody}`)
                    } else {
                      console.error(`VVB label creation failed for order ${bolOrder.orderId}: ${vvbRes.status} ${vvbBody}`)
                    }
                  } catch (vvbError) {
                    console.error(`Failed to create VVB label for order ${bolOrder.orderId}:`, vvbError)
                  }
                }
              } catch (acceptError) {
                console.error(`Failed to mark order ${bolOrder.orderId} as accepted:`, acceptError)
                // Non-blocking - continue with sync
              }
            }

            // Rate limiting between orders
            await rateLimitDelay(200)

          } catch (orderError) {
            console.error(`Error processing order ${orderId}:`, orderError)
            totalErrors++
            await rateLimitDelay(200)
          }
        }

        console.log(`Processed ${processedCount} new orders for connection ${connection.id}`)

        // Retry mechanism: find orders that were imported but not accepted
        // Bol.com has no accept endpoint — just mark as accepted directly
        const autoAcceptEnabled = settings.autoAcceptOrder as boolean
        if (autoAcceptEnabled) {
          try {
            console.log(`[RETRY] Checking for missed auto-accept orders (connection: ${connection.id})...`)
            const { data: missedOrders } = await supabase
              .from('orders')
              .select('id, marketplace_order_id, status')
              .eq('marketplace_connection_id', connection.id)
              .in('sync_status', ['synced', 'accept_failed', 'accept_skipped'])
              .eq('marketplace_source', 'bol_com')
              .not('status', 'in', '("cancelled","refunded")')
              .order('created_at', { ascending: true })
              .limit(5)

            if (missedOrders && missedOrders.length > 0) {
              console.log(`[RETRY] Found ${missedOrders.length} missed orders to mark as accepted`)

              for (const missed of missedOrders) {
                try {
                  console.log(`[RETRY] Marking order ${missed.marketplace_order_id} as accepted...`)
                  
                  await supabase
                    .from('orders')
                    .update({ sync_status: 'accepted', updated_at: new Date().toISOString() })
                    .eq('id', missed.id)

                  console.log(`[RETRY] Order ${missed.marketplace_order_id} marked as accepted`)
                  
                  // Auto-create VVB label if enabled
                  const vvbEnabled = settings.vvbEnabled as boolean
                  if (vvbEnabled) {
                    try {
                      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
                      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
                      const vvbCarrier = (settings.vvbDefaultCarrier as string) || 'POSTNL'
                      console.log(`[RETRY] Creating VVB label for ${missed.marketplace_order_id} with carrier ${vvbCarrier}...`)
                      const vvbRes = await fetch(`${supabaseUrl}/functions/v1/create-bol-vvb-label`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${serviceKey}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          order_id: missed.id,
                          carrier: vvbCarrier
                        })
                      })
                      const vvbBody = await vvbRes.text()
                      if (vvbRes.ok) {
                        console.log(`[RETRY] VVB label created for ${missed.marketplace_order_id}: ${vvbBody}`)
                      } else {
                        console.error(`[RETRY] VVB label failed for ${missed.marketplace_order_id}: ${vvbRes.status} ${vvbBody}`)
                      }
                    } catch (vvbError) {
                      console.error(`[RETRY] VVB error for ${missed.marketplace_order_id}:`, vvbError)
                    }
                  } else {
                    console.log(`[RETRY] VVB not enabled in settings, skipping label creation`)
                  }

                  await rateLimitDelay(500)
                } catch (retryError) {
                  console.error(`[RETRY] Error for ${missed.marketplace_order_id}:`, retryError)
                }
              }
            } else {
              console.log(`[RETRY] No missed orders found for auto-accept`)
            }
          } catch (retryLookupError) {
            console.error('[RETRY] Error looking up missed orders:', retryLookupError)
          }
        }

        // VVB Retry: find accepted orders that are missing a shipping label
        const vvbEnabled = settings.vvbEnabled as boolean
        if (vvbEnabled) {
          try {
            console.log(`[VVB-RETRY] Checking for accepted orders without VVB label (connection: ${connection.id})...`)

            // Find orders that are accepted but have no shipping label yet
            const { data: acceptedOrders } = await supabase
              .from('orders')
              .select('id, marketplace_order_id, order_number')
              .eq('marketplace_connection_id', connection.id)
              .eq('sync_status', 'accepted')
              .eq('marketplace_source', 'bol_com')
              .not('status', 'in', '("cancelled","refunded")')
              .order('created_at', { ascending: true })
              .limit(10) // fetch a bit more, we'll filter below

            if (acceptedOrders && acceptedOrders.length > 0) {
              // Check which of these orders already have a shipping label
              const orderIds = acceptedOrders.map(o => o.id)
              // Only count labels that are actually complete (have external_id or label_url)
              // Incomplete labels (both null) should be retried
              const { data: existingLabels } = await supabase
                .from('shipping_labels')
                .select('order_id')
                .in('order_id', orderIds)
                .or('external_id.not.is.null,label_url.not.is.null')

              const labelledOrderIds = new Set((existingLabels || []).map(l => l.order_id))
              const ordersWithoutLabel = acceptedOrders.filter(o => !labelledOrderIds.has(o.id))

              if (ordersWithoutLabel.length > 0) {
                console.log(`[VVB-RETRY] Found ${ordersWithoutLabel.length} accepted orders without VVB label`)
                const supabaseUrl = Deno.env.get('SUPABASE_URL')!
                const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
                const vvbCarrier = (settings.vvbDefaultCarrier as string) || 'POSTNL'

                // Process max 5 per cycle to avoid rate limits
                const toProcess = ordersWithoutLabel.slice(0, 5)
                for (const order of toProcess) {
                  try {
                    console.log(`[VVB-RETRY] Creating VVB label for order ${order.marketplace_order_id} (${order.order_number}) with carrier ${vvbCarrier}...`)
                    const vvbRes = await fetch(`${supabaseUrl}/functions/v1/create-bol-vvb-label`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${serviceKey}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        order_id: order.id,
                        carrier: vvbCarrier
                      })
                    })
                    const vvbBody = await vvbRes.text()
                    if (vvbRes.ok) {
                      console.log(`[VVB-RETRY] VVB label created for ${order.marketplace_order_id}: ${vvbBody}`)
                    } else {
                      console.error(`[VVB-RETRY] VVB label failed for ${order.marketplace_order_id}: ${vvbRes.status} ${vvbBody}`)
                    }
                  } catch (vvbRetryError) {
                    console.error(`[VVB-RETRY] Error creating VVB label for ${order.marketplace_order_id}:`, vvbRetryError)
                  }
                  // 1 second between calls to respect rate limits
                  await rateLimitDelay(1000)
                }
              } else {
                console.log(`[VVB-RETRY] All accepted orders already have VVB labels`)
              }
            } else {
              console.log(`[VVB-RETRY] No accepted orders without label found`)
            }
          } catch (vvbRetryLookupError) {
            console.error('[VVB-RETRY] Error looking up missed VVB labels:', vvbRetryLookupError)
          }
        }

        // === LABEL-PDF-RETRY: Retry labels that exist but have no PDF ===
        if (vvbEnabled) {
          try {
            console.log(`[LABEL-PDF-RETRY] Checking for labels without PDF (connection: ${connection.id})...`)

            const { data: incompleteLabelOrders } = await supabase
              .from('shipping_labels')
              .select('id, order_id, external_id, status, orders!inner(marketplace_order_id, order_number, tenant_id)')
              .or('status.eq.pending,and(status.eq.created,label_url.is.null)')
              .eq('provider', 'bol_vvb')
              .not('external_id', 'is', null)

            if (incompleteLabelOrders && incompleteLabelOrders.length > 0) {
              console.log(`[LABEL-PDF-RETRY] Found ${incompleteLabelOrders.length} labels without PDF`)
              const supabaseUrl = Deno.env.get('SUPABASE_URL')!
              const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

              for (const label of incompleteLabelOrders) {
                const orderData = label.orders as unknown as { marketplace_order_id: string; order_number: string; tenant_id: string }
                try {
                  console.log(`[LABEL-PDF-RETRY] Retrying PDF fetch for label ${label.id} (order ${orderData.order_number})...`)
                  const retryRes = await fetch(`${supabaseUrl}/functions/v1/create-bol-vvb-label`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${serviceKey}`,
                    },
                    body: JSON.stringify({
                      orderId: label.order_id,
                      connectionId: connection.id,
                      retry: true,
                    }),
                  })
                  const retryBody = await retryRes.text()
                  if (retryRes.ok) {
                    console.log(`[LABEL-PDF-RETRY] PDF fetched for ${orderData.order_number}: ${retryBody}`)
                  } else {
                    console.error(`[LABEL-PDF-RETRY] Failed for ${orderData.order_number}: ${retryRes.status} ${retryBody}`)
                  }
                } catch (retryErr) {
                  console.error(`[LABEL-PDF-RETRY] Error for ${orderData.order_number}:`, retryErr)
                }
                await new Promise(r => setTimeout(r, 1000))
              }
            } else {
              console.log(`[LABEL-PDF-RETRY] All labels have PDF URLs`)
            }
          } catch (labelRetryErr) {
            console.error('[LABEL-PDF-RETRY] Error:', labelRetryErr)
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
              totalOrders: ((currentStats.totalOrders as number) || 0) + processedCount,
              lastSync: new Date().toISOString(),
              // Mark historical import as completed if we performed one
              ...(shouldPerformHistoricalImport ? {
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
      // snake_case (existing)
      connections_processed: connections?.length || 0,
      orders_imported: totalImported,
      errors: totalErrors,
      // camelCase (for UI compatibility)
      connectionsProcessed: connections?.length || 0,
      ordersImported: totalImported,
      errorsCount: totalErrors
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
