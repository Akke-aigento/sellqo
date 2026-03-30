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
    
    const statusResponse = await fetch(`${BOL_API_BASE}/process-status/${processStatusId}`, {
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

    // Call Bol.com Accept Order API
    const acceptResponse = await fetch(`${BOL_API_BASE}/orders/${bolOrderId}/accept`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.retailer.v10+json',
        'Accept': 'application/vnd.retailer.v10+json'
      },
      body: JSON.stringify({
        orderItems: itemsToAccept
      })
    })

    const responseText = await acceptResponse.text()
    console.log('Bol accept response status:', acceptResponse.status)
    console.log('Bol accept response body:', responseText)

    if (!acceptResponse.ok) {
      if (acceptResponse.status === 403) {
        console.error('Bol.com 403 Forbidden - order may already be accepted or credentials lack write access')
        // Mark as accept_skipped so it's not retried forever but VVB can still proceed
        if (order_id) {
          await supabase
            .from('orders')
            .update({
              sync_status: 'accept_skipped',
              updated_at: new Date().toISOString()
            })
            .eq('id', order_id)
        }
        return new Response(
          JSON.stringify({
            success: false,
            error: `Bol.com 403 - order mogelijk al geaccepteerd of onvoldoende rechten`,
            sync_status: 'accept_skipped'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      throw new Error(`Failed to accept order: ${acceptResponse.status} - ${responseText}`)
    }

    const acceptResult = JSON.parse(responseText)
    const processStatusId = acceptResult.processStatusId
    console.log('Accept request acknowledged, processStatusId:', processStatusId)

    // Step 1: Set status to accept_pending and store processStatusId
    if (order_id) {
      await supabase
        .from('orders')
        .update({
          sync_status: 'accept_pending',
          bol_process_status_id: processStatusId,
          updated_at: new Date().toISOString()
        })
        .eq('id', order_id)
    }

    // Step 2: Poll for actual result
    const pollResult = await pollProcessStatus(accessToken, processStatusId)
    console.log('Poll result:', pollResult)

    if (order_id) {
      if (pollResult.status === 'SUCCESS') {
        await supabase
          .from('orders')
          .update({
            sync_status: 'accepted',
            updated_at: new Date().toISOString()
          })
          .eq('id', order_id)
        console.log('Order verified as accepted at Bol.com')
      } else if (pollResult.status === 'FAILURE' || pollResult.status === 'TIMEOUT') {
        await supabase
          .from('orders')
          .update({
            sync_status: 'accept_failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', order_id)
        console.error(`Order accept failed/timed out: ${pollResult.errorMessage}`)
      }
      // If still PENDING after all attempts, status stays 'accept_pending' for retry in next sync cycle
    }

    return new Response(
      JSON.stringify({
        success: true,
        processStatusId,
        verifiedStatus: pollResult.status,
        message: pollResult.status === 'SUCCESS' 
          ? 'Order accepted and verified' 
          : pollResult.status === 'PENDING'
            ? 'Order accept pending - will be verified in next sync cycle'
            : `Order accept ${pollResult.status.toLowerCase()}: ${pollResult.errorMessage}`
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
