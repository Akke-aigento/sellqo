import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const BOL_API_BASE = 'https://api.bol.com/retailer'
const BOL_TOKEN_URL = 'https://login.bol.com/token'

async function getBolAccessToken(clientId: string, clientSecret: string): Promise<string> {
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
  if (!response.ok) throw new Error(`Token request failed: ${response.statusText}`)
  const tokenData = await response.json()
  return tokenData.access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { connectionId, returnId, action, internalNotes } = await req.json()

    if (!connectionId || !returnId || !action) {
      return new Response(
        JSON.stringify({ success: false, error: 'connectionId, returnId, and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['accept', 'reject'].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: 'action must be "accept" or "reject"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get connection credentials
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) {
      throw new Error(`Connection not found: ${connError?.message}`)
    }

    const credentials = connection.credentials as { clientId: string; clientSecret: string }
    if (!credentials?.clientId || !credentials?.clientSecret) {
      throw new Error('Missing Bol.com credentials')
    }

    // Get return record
    const { data: returnRecord, error: retError } = await supabase
      .from('returns')
      .select('*')
      .eq('id', returnId)
      .eq('marketplace_connection_id', connectionId)
      .single()

    if (retError || !returnRecord) {
      throw new Error(`Return not found: ${retError?.message}`)
    }

    const bolReturnId = returnRecord.marketplace_return_id
    const token = await getBolAccessToken(credentials.clientId, credentials.clientSecret)

    // Get return items from raw data to build handling request
    const rawData = returnRecord.raw_marketplace_data as any
    const returnItems = rawData?.returnItems || []

    const handlingResult = action === 'accept' ? 'RETURN_RECEIVED' : 'RETURN_DOES_NOT_MEET_CONDITIONS'

    // Build handling request per item
    const handlingItems = returnItems.map((item: any) => ({
      rmaId: item.rmaId || bolReturnId,
      handlingResult,
      quantityReturned: item.quantity || 1,
    }))

    console.log(`[handle-bol-return] ${action} return ${bolReturnId} with ${handlingItems.length} items`)

    // Call Bol.com API to handle the return
    const bolResponse = await fetch(`${BOL_API_BASE}/returns`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/vnd.retailer.v10+json',
        'Accept': 'application/vnd.retailer.v10+json',
      },
      body: JSON.stringify({ handlingResult, quantityReturned: returnItems[0]?.quantity || 1 }),
    })

    // Bol.com returns 202 for async processing
    if (!bolResponse.ok && bolResponse.status !== 202) {
      const errorText = await bolResponse.text()
      console.error(`[handle-bol-return] Bol.com API error: ${bolResponse.status}`, errorText)
      throw new Error(`Bol.com API error: ${bolResponse.status} - ${errorText}`)
    }

    const newStatus = action === 'accept' ? 'approved' : 'rejected'

    // Update local return record
    const updateData: Record<string, unknown> = {
      status: newStatus,
      handling_result: handlingResult,
      updated_at: new Date().toISOString(),
    }
    if (internalNotes !== undefined) {
      updateData.internal_notes = internalNotes
    }

    const { error: updateError } = await supabase
      .from('returns')
      .update(updateData)
      .eq('id', returnId)

    if (updateError) {
      console.error(`[handle-bol-return] DB update error:`, updateError)
      throw new Error(`Failed to update return status: ${updateError.message}`)
    }

    console.log(`[handle-bol-return] Return ${bolReturnId} ${action}ed successfully`)

    return new Response(
      JSON.stringify({ success: true, status: newStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[handle-bol-return] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
