import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OdooCredentials {
  odooUrl: string
  odooDatabase: string
  odooUsername: string
  odooApiKey: string
}

interface OdooJsonRpcResponse {
  jsonrpc: string
  id: number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: { message: string }
  }
}

function normalizeOdooUrl(url: string): string {
  let normalized = url.trim()
  normalized = normalized.replace(/\/+$/, '')
  if (!normalized.startsWith('http')) {
    normalized = `https://${normalized}`
  }
  return normalized
}

async function odooAuthenticate(credentials: OdooCredentials): Promise<{ uid: number; sessionId: string } | null> {
  const { odooUrl, odooDatabase, odooUsername, odooApiKey } = credentials
  const normalizedUrl = normalizeOdooUrl(odooUrl)

  const response = await fetch(`${normalizedUrl}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: odooDatabase, login: odooUsername, password: odooApiKey },
      id: 1,
    }),
  })

  const data: OdooJsonRpcResponse = await response.json()
  const result = data.result as { uid?: number; session_id?: string } | null
  
  if (!result || !result.uid) return null

  // Extract session cookie
  const cookies = response.headers.get('set-cookie') || ''
  const sessionMatch = cookies.match(/session_id=([^;]+)/)
  const sessionId = sessionMatch ? sessionMatch[1] : ''

  return { uid: result.uid, sessionId }
}

async function odooCallMethod(
  credentials: OdooCredentials,
  sessionId: string,
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {}
): Promise<unknown> {
  const normalizedUrl = normalizeOdooUrl(credentials.odooUrl)

  const response = await fetch(`${normalizedUrl}/web/dataset/call_kw/${model}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs,
      },
      id: Date.now(),
    }),
  })

  const data: OdooJsonRpcResponse = await response.json()
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message)
  }
  return data.result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { connectionId } = await req.json()

    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) {
      throw new Error('Connection not found')
    }

    const credentials = connection.credentials as OdooCredentials
    const settings = connection.settings as { historicalPeriodDays?: number }

    // Authenticate with Odoo
    const auth = await odooAuthenticate(credentials)
    if (!auth) {
      throw new Error('Odoo authentication failed')
    }

    // Calculate date range
    const daysBack = settings.historicalPeriodDays || 90
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - daysBack)
    const sinceDateStr = sinceDate.toISOString().split('T')[0]

    // Fetch sale.order records
    const orderIds = await odooCallMethod(
      credentials,
      auth.sessionId,
      'sale.order',
      'search',
      [[['create_date', '>=', sinceDateStr], ['state', 'in', ['sale', 'done']]]],
      { limit: 500 }
    ) as number[]

    console.log(`Found ${orderIds.length} Odoo orders since ${sinceDateStr}`)

    if (orderIds.length === 0) {
      await supabase
        .from('marketplace_connections')
        .update({ last_sync_at: new Date().toISOString(), last_error: null })
        .eq('id', connectionId)

      return new Response(
        JSON.stringify({ success: true, ordersImported: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch order details
    const orders = await odooCallMethod(
      credentials,
      auth.sessionId,
      'sale.order',
      'read',
      [orderIds],
      { fields: ['name', 'partner_id', 'date_order', 'state', 'amount_total', 'currency_id', 'order_line'] }
    ) as Array<{
      id: number
      name: string
      partner_id: [number, string]
      date_order: string
      state: string
      amount_total: number
      currency_id: [number, string]
      order_line: number[]
    }>

    let importedCount = 0

    for (const order of orders) {
      // Check if order already exists
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('tenant_id', connection.tenant_id)
        .eq('marketplace_order_id', order.name)
        .single()

      if (existingOrder) continue

      // Fetch order lines
      const orderLines = await odooCallMethod(
        credentials,
        auth.sessionId,
        'sale.order.line',
        'read',
        [order.order_line],
        { fields: ['product_id', 'name', 'product_uom_qty', 'price_unit', 'price_subtotal', 'price_total'] }
      ) as Array<{
        id: number
        product_id: [number, string] | false
        name: string
        product_uom_qty: number
        price_unit: number
        price_subtotal: number
        price_total: number
      }>

      // Fetch partner/customer details
      const partner = await odooCallMethod(
        credentials,
        auth.sessionId,
        'res.partner',
        'read',
        [[order.partner_id[0]]],
        { fields: ['name', 'email', 'phone', 'street', 'city', 'zip', 'country_id', 'vat'] }
      ) as Array<{
        id: number
        name: string
        email: string | false
        phone: string | false
        street: string | false
        city: string | false
        zip: string | false
        country_id: [number, string] | false
        vat: string | false
      }>

      const customerData = partner[0]

      // Map Odoo state to our status
      const statusMap: Record<string, string> = {
        'draft': 'pending',
        'sent': 'pending',
        'sale': 'processing',
        'done': 'delivered',
        'cancel': 'cancelled',
      }

      // Create order in our system
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          tenant_id: connection.tenant_id,
          order_number: `ODOO-${order.name}`,
          marketplace_order_id: order.name,
          marketplace_source: 'odoo',
          status: statusMap[order.state] || 'pending',
          payment_status: order.state === 'sale' || order.state === 'done' ? 'paid' : 'pending',
          subtotal: order.amount_total * 0.79, // Approximate net (excl. BTW)
          tax_amount: order.amount_total * 0.21,
          shipping_cost: 0,
          discount_amount: 0,
          total: order.amount_total,
          currency: order.currency_id ? order.currency_id[1] : 'EUR',
          customer_email: customerData?.email || null,
          customer_name: customerData?.name || order.partner_id[1],
          customer_phone: customerData?.phone || null,
          billing_address: customerData ? {
            street: customerData.street || '',
            city: customerData.city || '',
            postal_code: customerData.zip || '',
            country: customerData.country_id ? customerData.country_id[1] : '',
            phone: customerData.phone || '',
          } : null,
          shipping_address: customerData ? {
            street: customerData.street || '',
            city: customerData.city || '',
            postal_code: customerData.zip || '',
            country: customerData.country_id ? customerData.country_id[1] : '',
            phone: customerData.phone || '',
          } : null,
          notes: `Geïmporteerd van Odoo (${order.name})`,
          created_at: order.date_order,
        })
        .select('id')
        .single()

      if (orderError) {
        console.error('Error creating order:', orderError)
        continue
      }

      // Create order items
      for (const line of orderLines) {
        await supabase.from('order_items').insert({
          tenant_id: connection.tenant_id,
          order_id: newOrder.id,
          product_name: line.name,
          sku: line.product_id ? `ODOO-${line.product_id[0]}` : null,
          quantity: line.product_uom_qty,
          unit_price: line.price_unit,
          subtotal: line.price_subtotal,
          tax_amount: line.price_total - line.price_subtotal,
          total: line.price_total,
        })
      }

      importedCount++
    }

    // Update connection last_sync_at
    await supabase
      .from('marketplace_connections')
      .update({ last_sync_at: new Date().toISOString(), last_error: null })
      .eq('id', connectionId)

    console.log(`Imported ${importedCount} new orders from Odoo`)

    return new Response(
      JSON.stringify({ success: true, ordersImported: importedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error syncing Odoo orders:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
