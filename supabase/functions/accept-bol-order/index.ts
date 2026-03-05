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
  tokenExpiry?: string
}

async function getBolAccessToken(credentials: BolCredentials): Promise<string> {
  const { clientId, clientSecret } = credentials
  console.log('Requesting Bol.com access token for accept-order, clientId starts with:', clientId.substring(0, 8) + '...')

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
    console.error('Token request failed:', response.status, errorText)
    throw new Error(`Token request failed: ${response.status} - ${errorText}`)
  }

  const tokenData = await response.json()
  console.log('Got Bol.com access token, expires in:', tokenData.expires_in)
  return tokenData.access_token
}

async function pollProcessStatus(accessToken: string, processStatusId: string, maxAttempts = 10, intervalMs = 2000): Promise<{ status: string; errorMessage?: string }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[POLL] Checking process status ${processStatusId}, attempt ${attempt}/${maxAttempts}...`)
    
    const statusResponse = await fetch(`https://api.bol.com/shared/process-status/${processStatusId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.retailer.v10+json'
      }
    })

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text()
      console.error(`[POLL] Process status request failed: ${statusResponse.status} - ${errorText}`)
      // Don't throw, just continue polling
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs))
        continue
      }
      return { status: 'TIMEOUT', errorMessage: `Failed to check process status: ${statusResponse.status}` }
    }

    const statusData = await statusResponse.json()
    console.log(`[POLL] Process status: ${statusData.status}`)

    if (statusData.status === 'SUCCESS') {
      return { status: 'SUCCESS' }
    } else if (statusData.status === 'FAILURE') {
      return { status: 'FAILURE', errorMessage: statusData.errorMessage || 'Accept failed at Bol.com' }
    } else if (statusData.status === 'TIMEOUT') {
      return { status: 'TIMEOUT', errorMessage: 'Process timed out at Bol.com' }
    }

    // PENDING - wait and retry
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }

  // Exhausted all attempts while still PENDING
  console.log(`[POLL] Process status still PENDING after ${maxAttempts} attempts`)
  return { status: 'PENDING' }
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

    const credentials = connection.credentials as BolCredentials
    const accessToken = await getBolAccessToken(credentials)

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

    // Bol.com v10 API: FBR orders are auto-accepted by Bol.com.
    // There is no explicit "accept" endpoint in v10. The retailer just needs to ship the order.
    // We mark the order as accepted locally to reflect that we've acknowledged it.
    console.log('Bol.com v10: FBR orders are auto-accepted. Marking order as accepted locally.')
    
    if (order_id) {
      await supabase.from('orders').update({
        sync_status: 'accepted',
        updated_at: new Date().toISOString()
      }).eq('id', order_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order geaccepteerd. Bol.com FBR orders worden automatisch geaccepteerd.',
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
