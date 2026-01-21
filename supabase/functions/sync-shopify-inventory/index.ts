import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncRequest {
  connectionId: string
  direction?: 'import' | 'export' | 'bidirectional'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { connectionId, direction = 'bidirectional' } = await req.json() as SyncRequest

    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection ID is verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get connection details
    const { data: connection, error: connectionError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (connectionError || !connection) {
      throw new Error('Marketplace verbinding niet gevonden')
    }

    const credentials = connection.credentials as { storeUrl: string; accessToken: string }
    const settings = connection.settings as { safetyStock?: number }
    const safetyStock = settings?.safetyStock || 0
    
    // Normalize store URL
    let storeUrl = credentials.storeUrl.trim().toLowerCase()
    storeUrl = storeUrl.replace(/^https?:\/\//, '')
    storeUrl = storeUrl.replace(/\/+$/, '')

    console.log(`Syncing Shopify inventory for store ${storeUrl}, direction: ${direction}`)

    // Get products with shopify_product_id from SellQo
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, stock, shopify_product_id, shopify_variant_id')
      .eq('tenant_id', connection.tenant_id)
      .not('shopify_product_id', 'is', null)

    if (productsError) {
      throw new Error(`Error fetching products: ${productsError.message}`)
    }

    let productsSynced = 0
    let inventoryUpdated = 0
    const errors: string[] = []

    if (direction === 'export' || direction === 'bidirectional') {
      // Export inventory from SellQo to Shopify
      for (const product of products || []) {
        if (!product.shopify_variant_id) continue

        try {
          // First, get the inventory item ID for this variant
          const variantUrl = `https://${storeUrl}/admin/api/2024-01/variants/${product.shopify_variant_id}.json`
          const variantResponse = await fetch(variantUrl, {
            method: 'GET',
            headers: {
              'X-Shopify-Access-Token': credentials.accessToken,
              'Content-Type': 'application/json',
            },
          })

          if (!variantResponse.ok) {
            console.error(`Failed to get variant ${product.shopify_variant_id}`)
            continue
          }

          const variantData = await variantResponse.json()
          const inventoryItemId = variantData.variant?.inventory_item_id

          if (!inventoryItemId) {
            console.error(`No inventory item ID for variant ${product.shopify_variant_id}`)
            continue
          }

          // Get location ID (first location)
          const locationsUrl = `https://${storeUrl}/admin/api/2024-01/locations.json`
          const locationsResponse = await fetch(locationsUrl, {
            method: 'GET',
            headers: {
              'X-Shopify-Access-Token': credentials.accessToken,
              'Content-Type': 'application/json',
            },
          })

          if (!locationsResponse.ok) {
            console.error('Failed to get locations')
            continue
          }

          const locationsData = await locationsResponse.json()
          const locationId = locationsData.locations?.[0]?.id

          if (!locationId) {
            console.error('No location found')
            continue
          }

          // Calculate stock with safety stock
          const stockToSync = Math.max(0, (product.stock || 0) - safetyStock)

          // Set inventory level
          const setInventoryUrl = `https://${storeUrl}/admin/api/2024-01/inventory_levels/set.json`
          const setResponse = await fetch(setInventoryUrl, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': credentials.accessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              location_id: locationId,
              inventory_item_id: inventoryItemId,
              available: stockToSync,
            }),
          })

          if (setResponse.ok) {
            inventoryUpdated++
            
            // Update last synced timestamp
            await supabase
              .from('products')
              .update({ shopify_last_synced_at: new Date().toISOString() })
              .eq('id', product.id)
          } else {
            const errorText = await setResponse.text()
            errors.push(`Product ${product.name}: ${errorText}`)
          }

          productsSynced++
        } catch (err) {
          console.error(`Error syncing product ${product.id}:`, err)
          errors.push(`Product ${product.name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
    }

    if (direction === 'import' || direction === 'bidirectional') {
      // Import inventory from Shopify to SellQo
      // Fetch all products from Shopify
      const productsUrl = `https://${storeUrl}/admin/api/2024-01/products.json?limit=250`
      const response = await fetch(productsUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': credentials.accessToken,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        const shopifyProducts = data.products || []

        for (const shopifyProduct of shopifyProducts) {
          for (const variant of shopifyProduct.variants || []) {
            // Try to match by SKU
            if (variant.sku) {
              const { data: matchedProducts } = await supabase
                .from('products')
                .select('id, stock')
                .eq('tenant_id', connection.tenant_id)
                .eq('sku', variant.sku)
                .single()

              if (matchedProducts) {
                const shopifyStock = variant.inventory_quantity || 0
                
                // Only update if direction is import (not bidirectional, to avoid conflicts)
                if (direction === 'import') {
                  await supabase
                    .from('products')
                    .update({
                      stock: shopifyStock,
                      shopify_product_id: shopifyProduct.id.toString(),
                      shopify_variant_id: variant.id.toString(),
                      shopify_last_synced_at: new Date().toISOString(),
                    })
                    .eq('id', matchedProducts.id)

                  productsSynced++
                }
              }
            }
          }
        }
      }
    }

    // Update connection last_sync_at
    await supabase
      .from('marketplace_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: errors.length > 0 ? errors.slice(0, 3).join('; ') : null,
      })
      .eq('id', connectionId)

    console.log(`Inventory sync complete: ${productsSynced} processed, ${inventoryUpdated} updated`)

    return new Response(
      JSON.stringify({
        success: true,
        productsSynced,
        inventoryUpdated,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Sync failed'
    console.error('Shopify inventory sync error:', errorMessage)

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
