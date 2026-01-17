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

interface MarketplaceSettings {
  safetyStock?: number
  lowStockThreshold?: number
  autoSyncInventory?: boolean
}

interface ProductMarketplaceMappings {
  bol_com?: {
    offerId: string
    lastSync?: string
  }
  amazon?: {
    sku: string
    lastSync?: string
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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting Bol.com inventory sync...')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Parse optional request body for specific connection or product
    const body = await req.json().catch(() => ({}))
    const { connectionId, productId } = body

    // Build query for active Bol.com connections
    let connectionsQuery = supabase
      .from('marketplace_connections')
      .select('*')
      .eq('marketplace_type', 'bol_com')
      .eq('is_active', true)

    if (connectionId) {
      connectionsQuery = connectionsQuery.eq('id', connectionId)
    }

    const { data: connections, error: connError } = await connectionsQuery

    if (connError) {
      console.error('Error fetching connections:', connError)
      throw connError
    }

    console.log(`Found ${connections?.length || 0} active Bol.com connections`)

    let totalSynced = 0
    let totalErrors = 0

    for (const connection of connections || []) {
      try {
        console.log(`Syncing inventory for connection: ${connection.id}`)

        const credentials = connection.credentials as BolCredentials
        const settings = (connection.settings || {}) as MarketplaceSettings
        
        // Get OAuth token
        const accessToken = await getBolAccessToken(credentials)
        console.log('Successfully obtained access token')

        // Get products that need syncing (have EAN and sync enabled)
        let productsQuery = supabase
          .from('products')
          .select('*')
          .eq('tenant_id', connection.tenant_id)
          .eq('sync_inventory', true)
          .not('bol_ean', 'is', null)

        if (productId) {
          productsQuery = productsQuery.eq('id', productId)
        }

        const { data: products, error: productsError } = await productsQuery

        if (productsError) {
          console.error('Error fetching products:', productsError)
          throw productsError
        }

        console.log(`Found ${products?.length || 0} products to sync for connection ${connection.id}`)

        for (const product of products || []) {
          try {
            const mappings = (product.marketplace_mappings || {}) as ProductMarketplaceMappings
            const bolMapping = mappings.bol_com
            
            if (!bolMapping?.offerId) {
              console.log(`Product ${product.id} has no Bol.com offer ID, skipping`)
              continue
            }

            // Calculate quantity to send (apply safety stock)
            const safetyStock = settings.safetyStock || 0
            const currentStock = product.stock || 0
            const quantityToSync = Math.max(0, currentStock - safetyStock)

            console.log(`Syncing product ${product.id}: stock=${currentStock}, safety=${safetyStock}, sending=${quantityToSync}`)

            // Update inventory on Bol.com
            const updateResponse = await fetch(
              `${BOL_API_BASE}/offers/${bolMapping.offerId}/stock`,
              {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Accept': 'application/vnd.retailer.v10+json',
                  'Content-Type': 'application/vnd.retailer.v10+json'
                },
                body: JSON.stringify({
                  amount: quantityToSync,
                  managedByRetailer: true
                })
              }
            )

            if (!updateResponse.ok) {
              const errorText = await updateResponse.text()
              console.error(`Bol API error for product ${product.id}:`, errorText)
              throw new Error(`Bol API error: ${updateResponse.statusText}`)
            }

            // Update product last sync timestamp and mappings
            const updatedMappings: ProductMarketplaceMappings = {
              ...mappings,
              bol_com: {
                ...bolMapping,
                lastSync: new Date().toISOString()
              }
            }

            await supabase
              .from('products')
              .update({
                last_inventory_sync: new Date().toISOString(),
                marketplace_mappings: updatedMappings
              })
              .eq('id', product.id)

            // Log successful sync
            await supabase
              .from('inventory_sync_log')
              .insert({
                product_id: product.id,
                marketplace_connection_id: connection.id,
                marketplace_type: 'bol_com',
                tenant_id: connection.tenant_id,
                old_quantity: currentStock,
                new_quantity: quantityToSync,
                sync_status: 'success'
              })

            console.log(`Successfully synced inventory for product ${product.id}`)
            totalSynced++

          } catch (productError) {
            const errorMessage = productError instanceof Error ? productError.message : 'Unknown error'
            console.error(`Failed to sync product ${product.id}:`, errorMessage)
            
            // Log failed sync
            await supabase
              .from('inventory_sync_log')
              .insert({
                product_id: product.id,
                marketplace_connection_id: connection.id,
                marketplace_type: 'bol_com',
                tenant_id: connection.tenant_id,
                sync_status: 'failed',
                error_message: errorMessage
              })
            
            totalErrors++
          }
        }

        // Update connection last sync
        await supabase
          .from('marketplace_connections')
          .update({
            last_sync_at: new Date().toISOString()
          })
          .eq('id', connection.id)

      } catch (connectionError) {
        const errorMessage = connectionError instanceof Error ? connectionError.message : 'Unknown error'
        console.error(`Inventory sync failed for connection ${connection.id}:`, errorMessage)
        totalErrors++
      }
    }

    const result = {
      success: true,
      connections_processed: connections?.length || 0,
      products_synced: totalSynced,
      errors: totalErrors
    }

    console.log('Inventory sync completed:', result)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Fatal error in sync-bol-inventory:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
