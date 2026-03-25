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
  const { clientId, clientSecret, accessToken, tokenExpiry } = credentials
  if (accessToken && tokenExpiry && new Date(tokenExpiry) > new Date()) {
    return accessToken
  }
  const authString = btoa(`${clientId}:${clientSecret}`)
  const response = await fetch(BOL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authString}`,
      'Accept': 'application/json',
    },
    body: 'grant_type=client_credentials',
  })
  if (!response.ok) {
    throw new Error(`Token request failed: ${response.statusText}`)
  }
  const tokenData = await response.json()
  return tokenData.access_token
}

function mapBolReturnStatus(handled: boolean, handlingResult?: string): string {
  if (!handled) return 'registered'
  switch (handlingResult) {
    case 'RETURN_RECEIVED': return 'received'
    case 'EXCHANGE_PRODUCT': return 'exchanged'
    case 'REPAIR': return 'repaired'
    case 'CUSTOMER_KEEPS_PRODUCT_PAID': return 'approved'
    case 'STILL_APPROVED': return 'approved'
    case 'CUSTOMER_KEEPS_PRODUCT_FREE_OF_CHARGE': return 'approved'
    case 'RETURN_DOES_NOT_MEET_CONDITIONS': return 'rejected'
    case 'EXPIRED': return 'rejected'
    default: return 'received'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { connectionId } = await req.json()
    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'connectionId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get connection
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    const settings = (connection?.settings || {}) as Record<string, unknown>
    const autoAcceptReturns = settings.autoAcceptReturns === true
    if (connError || !connection) {
      throw new Error(`Connection not found: ${connError?.message}`)
    }

    const credentials = connection.credentials as BolCredentials
    if (!credentials?.clientId || !credentials?.clientSecret) {
      throw new Error('Missing Bol.com credentials')
    }

    const token = await getBolAccessToken(credentials)
    console.log(`[sync-bol-returns] Fetching returns for connection ${connectionId}`)

    // Fetch unhandled returns
    const unhandledRes = await fetch(`${BOL_API_BASE}/returns?handled=false&fulfilment-method=FBR`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.retailer.v10+json',
      },
    })

    let allReturns: any[] = []

    if (unhandledRes.ok) {
      const unhandledData = await unhandledRes.json()
      allReturns = allReturns.concat(unhandledData.returns || [])
    } else {
      console.error(`[sync-bol-returns] Unhandled returns fetch failed: ${unhandledRes.status}`)
    }

    // Fetch handled returns for status updates
    const handledRes = await fetch(`${BOL_API_BASE}/returns?handled=true&fulfilment-method=FBR`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.retailer.v10+json',
      },
    })

    if (handledRes.ok) {
      const handledData = await handledRes.json()
      allReturns = allReturns.concat(handledData.returns || [])
    }

    console.log(`[sync-bol-returns] Found ${allReturns.length} total returns`)

    let imported = 0
    let updated = 0
    const errors: string[] = []

    // Try to match returns to existing orders
    for (const ret of allReturns) {
      try {
        const returnId = String(ret.returnId || ret.rmaId)
        const orderId = ret.orderId ? String(ret.orderId) : null

        // Build items array
        const items = (ret.returnItems || []).map((item: any) => ({
          ean: item.ean,
          title: item.title || item.product?.title,
          quantity: item.quantity || 1,
          returnReason: item.returnReason?.mainReason,
          returnReasonDetail: item.returnReason?.detailedReason,
          handlingResult: item.handlingResult,
        }))

        // Extract reason from first item
        const firstItem = ret.returnItems?.[0]
        const returnReason = firstItem?.returnReason?.detailedReason || firstItem?.returnReason?.mainReason || null
        const returnReasonCode = firstItem?.returnReason?.mainReason || null
        const handlingResult = firstItem?.handlingResult || null

        // Customer name
        const customerName = ret.customerDetails
          ? `${ret.customerDetails.firstName || ''} ${ret.customerDetails.surname || ''}`.trim()
          : null

        // Try to match to SellQo order
        let matchedOrderId: string | null = null
        if (orderId) {
          const { data: matchedOrder } = await supabase
            .from('orders')
            .select('id')
            .eq('tenant_id', connection.tenant_id)
            .eq('marketplace_order_id', orderId)
            .maybeSingle()
          matchedOrderId = matchedOrder?.id || null
        }

        const status = mapBolReturnStatus(!!ret.handled, handlingResult)
        const registrationDate = ret.registrationDateTime || ret.creationDateTime || null

        const row = {
          tenant_id: connection.tenant_id,
          marketplace_connection_id: connectionId,
          marketplace_return_id: returnId,
          marketplace_order_id: orderId,
          order_id: matchedOrderId,
          status,
          return_reason: returnReason,
          return_reason_code: returnReasonCode,
          customer_name: customerName,
          items,
          handling_result: handlingResult,
          registration_date: registrationDate,
          raw_marketplace_data: ret,
          updated_at: new Date().toISOString(),
        }

        const { error: upsertError } = await supabase
          .from('returns')
          .upsert(row, { onConflict: 'marketplace_connection_id,marketplace_return_id' })

        if (upsertError) {
          console.error(`[sync-bol-returns] Upsert error for return ${returnId}:`, upsertError)
          errors.push(`Return ${returnId}: ${upsertError.message}`)
        } else {
          imported++
        }
      } catch (itemErr) {
        const msg = itemErr instanceof Error ? itemErr.message : String(itemErr)
        errors.push(msg)
      }
    }

    // Update last_sync_at
    await supabase
      .from('marketplace_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId)

    console.log(`[sync-bol-returns] Done: ${imported} synced, ${errors.length} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        returnsImported: imported,
        totalFound: allReturns.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[sync-bol-returns] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
