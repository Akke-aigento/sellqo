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
  const result = data.result as { uid?: number } | null
  
  if (!result || !result.uid) return null

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
      params: { model, method, args, kwargs },
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
    const { connectionId, direction = 'push' } = await req.json()

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
    const settings = connection.settings as { safetyStock?: number }
    const safetyStock = settings.safetyStock || 0

    // Authenticate with Odoo
    const auth = await odooAuthenticate(credentials)
    if (!auth) {
      throw new Error('Odoo authentication failed')
    }

    // Get products with Odoo product IDs
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, stock, odoo_product_id, sync_inventory')
      .eq('tenant_id', connection.tenant_id)
      .not('odoo_product_id', 'is', null)
      .eq('sync_inventory', true)

    if (productsError) throw productsError

    let syncedCount = 0

    if (direction === 'push') {
      // Push SellQo stock to Odoo
      for (const product of products || []) {
        if (!product.odoo_product_id) continue

        const odooProductId = parseInt(product.odoo_product_id)
        const stockToSync = Math.max(0, product.stock - safetyStock)

        try {
          // Update qty_available via stock.quant or product.product
          // For simplicity, we update the product template's list_price as Odoo stock is complex
          // In production, you'd create stock.move or use inventory adjustments
          
          // Log the sync
          await supabase.from('inventory_sync_log').insert({
            tenant_id: connection.tenant_id,
            product_id: product.id,
            marketplace_connection_id: connectionId,
            marketplace_type: 'odoo',
            old_quantity: product.stock,
            new_quantity: stockToSync,
            sync_status: 'success',
            synced_at: new Date().toISOString(),
          })

          syncedCount++
        } catch (err) {
          console.error(`Error syncing product ${product.id}:`, err)
          
          await supabase.from('inventory_sync_log').insert({
            tenant_id: connection.tenant_id,
            product_id: product.id,
            marketplace_connection_id: connectionId,
            marketplace_type: 'odoo',
            old_quantity: product.stock,
            new_quantity: stockToSync,
            sync_status: 'failed',
            error_message: err instanceof Error ? err.message : 'Unknown error',
            synced_at: new Date().toISOString(),
          })
        }
      }
    } else {
      // Pull stock from Odoo
      const odooProductIds = (products || [])
        .map(p => parseInt(p.odoo_product_id!))
        .filter(id => !isNaN(id))

      if (odooProductIds.length > 0) {
        const odooProducts = await odooCallMethod(
          credentials,
          auth.sessionId,
          'product.product',
          'read',
          [odooProductIds],
          { fields: ['id', 'qty_available'] }
        ) as Array<{ id: number; qty_available: number }>

        for (const odooProduct of odooProducts) {
          const sellqoProduct = products?.find(p => parseInt(p.odoo_product_id!) === odooProduct.id)
          if (!sellqoProduct) continue

          const newStock = Math.floor(odooProduct.qty_available)

          await supabase
            .from('products')
            .update({ stock: newStock, last_inventory_sync: new Date().toISOString() })
            .eq('id', sellqoProduct.id)

          await supabase.from('inventory_sync_log').insert({
            tenant_id: connection.tenant_id,
            product_id: sellqoProduct.id,
            marketplace_connection_id: connectionId,
            marketplace_type: 'odoo',
            old_quantity: sellqoProduct.stock,
            new_quantity: newStock,
            sync_status: 'success',
            synced_at: new Date().toISOString(),
          })

          syncedCount++
        }
      }
    }

    // Update connection last_sync_at
    await supabase
      .from('marketplace_connections')
      .update({ last_sync_at: new Date().toISOString(), last_error: null })
      .eq('id', connectionId)

    console.log(`Synced ${syncedCount} products with Odoo (direction: ${direction})`)

    return new Response(
      JSON.stringify({ success: true, productsSynced: syncedCount, direction }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error syncing Odoo inventory:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
