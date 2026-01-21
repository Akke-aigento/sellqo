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
  error?: { code: number; message: string; data?: { message: string } }
}

function normalizeOdooUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, '')
  if (!normalized.startsWith('http')) normalized = `https://${normalized}`
  return normalized
}

async function odooAuthenticate(credentials: OdooCredentials): Promise<{ uid: number; sessionId: string } | null> {
  const normalizedUrl = normalizeOdooUrl(credentials.odooUrl)
  const response = await fetch(`${normalizedUrl}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: credentials.odooDatabase, login: credentials.odooUsername, password: credentials.odooApiKey },
      id: 1,
    }),
  })

  const data: OdooJsonRpcResponse = await response.json()
  const result = data.result as { uid?: number } | null
  if (!result?.uid) return null

  const cookies = response.headers.get('set-cookie') || ''
  const sessionMatch = cookies.match(/session_id=([^;]+)/)
  return { uid: result.uid, sessionId: sessionMatch?.[1] || '' }
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
    headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs }, id: Date.now() }),
  })

  const data: OdooJsonRpcResponse = await response.json()
  if (data.error) throw new Error(data.error.data?.message || data.error.message)
  return data.result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { product_id, tenant_id, connection_id } = await req.json()

    if (!product_id || !tenant_id || !connection_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'product_id, tenant_id and connection_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get connection
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connection_id)
      .single()

    if (connError || !connection) throw new Error('Connection not found')

    // Get product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('tenant_id', tenant_id)
      .single()

    if (productError || !product) throw new Error('Product not found')

    const credentials = connection.credentials as OdooCredentials
    const settings = connection.settings as Record<string, unknown>

    // Check if e-commerce module is enabled
    if (settings.odooModuleEcommerce === false) {
      return new Response(
        JSON.stringify({ success: false, error: 'E-commerce module not enabled for this Odoo connection' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mark as pending
    await supabase
      .from('products')
      .update({ odoo_listing_status: 'pending', odoo_listing_error: null })
      .eq('id', product_id)

    // Authenticate with Odoo
    const auth = await odooAuthenticate(credentials)
    if (!auth) throw new Error('Odoo authentication failed')

    // Create product in Odoo
    const productData = {
      name: product.odoo_optimized_title || product.name,
      description_sale: product.odoo_optimized_description || product.description || '',
      list_price: product.price,
      default_code: product.sku || '',
      barcode: product.barcode || false,
      type: product.requires_shipping ? 'product' : 'service',
      sale_ok: true,
      purchase_ok: false,
      active: product.is_active,
    }

    const odooProductId = await odooCallMethod(
      credentials,
      auth.sessionId,
      'product.product',
      'create',
      [productData]
    ) as number

    // Update product with Odoo ID
    await supabase
      .from('products')
      .update({
        odoo_product_id: odooProductId.toString(),
        odoo_listing_status: 'listed',
        odoo_listing_error: null,
        odoo_last_synced_at: new Date().toISOString(),
        sync_inventory: true,
      })
      .eq('id', product_id)

    console.log(`Created Odoo product ${odooProductId} for SellQo product ${product_id}`)

    return new Response(
      JSON.stringify({ success: true, odoo_product_id: odooProductId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error creating Odoo product:', errorMessage)

    // Update product with error
    try {
      const { product_id } = await req.clone().json()
      if (product_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)
        
        await supabase
          .from('products')
          .update({ odoo_listing_status: 'error', odoo_listing_error: errorMessage })
          .eq('id', product_id)
      }
    } catch (e) {
      console.error('Could not update product error status:', e)
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
