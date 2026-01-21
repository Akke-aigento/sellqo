import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WooCommerceCredentials {
  siteUrl: string
  consumerKey: string
  consumerSecret: string
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
    const { connectionId, direction = 'export' } = await req.json()

    if (!connectionId) {
      throw new Error('connectionId is required')
    }

    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) {
      throw new Error('Connection not found')
    }

    const credentials = connection.credentials as WooCommerceCredentials
    
    // Normalize site URL
    let siteUrl = credentials.siteUrl.trim()
    siteUrl = siteUrl.replace(/\/+$/, '')
    if (!siteUrl.startsWith('http')) {
      siteUrl = `https://${siteUrl}`
    }

    const authString = btoa(`${credentials.consumerKey}:${credentials.consumerSecret}`)

    // Get products with WooCommerce product IDs
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, sku, stock, woocommerce_product_id, woocommerce_variant_id')
      .eq('tenant_id', connection.tenant_id)
      .eq('track_inventory', true)
      .not('woocommerce_product_id', 'is', null)

    if (prodError) {
      throw new Error('Failed to fetch products')
    }

    console.log(`Found ${products?.length || 0} products to sync inventory`)

    let productsSynced = 0
    let errors: string[] = []
    const settings = connection.settings as { safetyStock?: number } | null
    const safetyStock = settings?.safetyStock || 0

    for (const product of products || []) {
      try {
        // Calculate stock to sync (apply safety stock)
        const stockToSync = Math.max(0, (product.stock || 0) - safetyStock)

        if (direction === 'export') {
          // Update WooCommerce inventory
          const updateUrl = `${siteUrl}/wp-json/wc/v3/products/${product.woocommerce_product_id}`
          
          const updatePayload: any = {
            stock_quantity: stockToSync,
            manage_stock: true,
          }

          // If it's a variation, update the variation instead
          if (product.woocommerce_variant_id) {
            const variantUrl = `${siteUrl}/wp-json/wc/v3/products/${product.woocommerce_product_id}/variations/${product.woocommerce_variant_id}`
            
            const variantResponse = await fetch(variantUrl, {
              method: 'PUT',
              headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updatePayload),
            })

            if (!variantResponse.ok) {
              const errorText = await variantResponse.text()
              console.error(`Failed to update variant ${product.woocommerce_variant_id}:`, errorText)
              errors.push(`Product ${product.name}: ${variantResponse.status}`)
              continue
            }
          } else {
            const response = await fetch(updateUrl, {
              method: 'PUT',
              headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updatePayload),
            })

            if (!response.ok) {
              const errorText = await response.text()
              console.error(`Failed to update product ${product.woocommerce_product_id}:`, errorText)
              errors.push(`Product ${product.name}: ${response.status}`)
              continue
            }
          }

          // Log the sync
          await supabase.from('inventory_sync_log').insert({
            tenant_id: connection.tenant_id,
            product_id: product.id,
            marketplace_connection_id: connectionId,
            marketplace_type: 'woocommerce',
            old_quantity: product.stock || 0,
            new_quantity: stockToSync,
            sync_status: 'success',
            synced_at: new Date().toISOString(),
          })

          productsSynced++
        } else {
          // Import from WooCommerce (direction === 'import')
          const productUrl = product.woocommerce_variant_id
            ? `${siteUrl}/wp-json/wc/v3/products/${product.woocommerce_product_id}/variations/${product.woocommerce_variant_id}`
            : `${siteUrl}/wp-json/wc/v3/products/${product.woocommerce_product_id}`

          const response = await fetch(productUrl, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          })

          if (response.ok) {
            const wooProduct = await response.json()
            const wooStock = wooProduct.stock_quantity || 0

            // Update local stock
            await supabase
              .from('products')
              .update({ stock: wooStock })
              .eq('id', product.id)

            // Log the sync
            await supabase.from('inventory_sync_log').insert({
              tenant_id: connection.tenant_id,
              product_id: product.id,
              marketplace_connection_id: connectionId,
              marketplace_type: 'woocommerce',
              old_quantity: product.stock || 0,
              new_quantity: wooStock,
              sync_status: 'success',
              synced_at: new Date().toISOString(),
            })

            productsSynced++
          } else {
            errors.push(`Product ${product.name}: ${response.status}`)
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`Product ${product.name}: ${errMsg}`)
      }
    }

    // Update last_sync_at on connection
    await supabase
      .from('marketplace_connections')
      .update({ 
        last_sync_at: new Date().toISOString(),
        last_error: errors.length > 0 ? errors.join('; ') : null,
      })
      .eq('id', connectionId)

    console.log(`WooCommerce inventory sync complete: ${productsSynced} synced, ${errors.length} errors`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        productsSynced,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error syncing WooCommerce inventory:', errorMessage)
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
