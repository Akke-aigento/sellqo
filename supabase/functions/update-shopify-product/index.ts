import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateProductRequest {
  product_id: string
  tenant_id: string
  connection_id: string
  update_type: 'price' | 'stock' | 'all'
  update_data?: {
    price?: number
    stock?: number
  }
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
    const { product_id, tenant_id, connection_id, update_type, update_data } = await req.json() as UpdateProductRequest

    if (!product_id || !tenant_id || !connection_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Product ID, Tenant ID en Connection ID zijn verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get connection details
    const { data: connection, error: connectionError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connection_id)
      .single()

    if (connectionError || !connection) {
      throw new Error('Marketplace verbinding niet gevonden')
    }

    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('tenant_id', tenant_id)
      .single()

    if (productError || !product) {
      throw new Error('Product niet gevonden')
    }

    if (!product.shopify_product_id || !product.shopify_variant_id) {
      throw new Error('Product is niet gepubliceerd naar Shopify')
    }

    const credentials = connection.credentials as { storeUrl: string; accessToken: string }
    const settings = connection.settings as { safetyStock?: number }
    const safetyStock = settings?.safetyStock || 0
    
    // Normalize store URL
    let storeUrl = credentials.storeUrl.trim().toLowerCase()
    storeUrl = storeUrl.replace(/^https?:\/\//, '')
    storeUrl = storeUrl.replace(/\/+$/, '')

    console.log(`Updating product in Shopify: ${product.name} (${update_type})`)

    const priceToSync = update_data?.price ?? product.price
    const stockToSync = Math.max(0, (update_data?.stock ?? product.stock ?? 0) - safetyStock)

    // Update variant (price and inventory_quantity cannot be updated together easily)
    if (update_type === 'price' || update_type === 'all') {
      const variantUrl = `https://${storeUrl}/admin/api/2024-01/variants/${product.shopify_variant_id}.json`
      const variantResponse = await fetch(variantUrl, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': credentials.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variant: {
            id: product.shopify_variant_id,
            price: priceToSync.toString(),
          },
        }),
      })

      if (!variantResponse.ok) {
        const errorText = await variantResponse.text()
        console.error('Shopify variant update error:', errorText)
        throw new Error(`Prijs update mislukt: ${errorText.substring(0, 100)}`)
      }
    }

    if (update_type === 'stock' || update_type === 'all') {
      // Get inventory item ID
      const variantUrl = `https://${storeUrl}/admin/api/2024-01/variants/${product.shopify_variant_id}.json`
      const variantResponse = await fetch(variantUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': credentials.accessToken,
          'Content-Type': 'application/json',
        },
      })

      if (!variantResponse.ok) {
        throw new Error('Kon variant niet ophalen')
      }

      const variantData = await variantResponse.json()
      const inventoryItemId = variantData.variant?.inventory_item_id

      if (inventoryItemId) {
        // Get location ID
        const locationsUrl = `https://${storeUrl}/admin/api/2024-01/locations.json`
        const locationsResponse = await fetch(locationsUrl, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': credentials.accessToken,
            'Content-Type': 'application/json',
          },
        })

        if (locationsResponse.ok) {
          const locationsData = await locationsResponse.json()
          const locationId = locationsData.locations?.[0]?.id

          if (locationId) {
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

            if (!setResponse.ok) {
              const errorText = await setResponse.text()
              console.error('Shopify inventory update error:', errorText)
              throw new Error(`Voorraad update mislukt: ${errorText.substring(0, 100)}`)
            }
          }
        }
      }
    }

    // Update last synced timestamp
    await supabase
      .from('products')
      .update({
        shopify_last_synced_at: new Date().toISOString(),
        shopify_listing_error: null,
      })
      .eq('id', product_id)

    console.log(`Product updated in Shopify: ${product.name}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Product succesvol bijgewerkt in Shopify',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update product'
    console.error('Update Shopify product error:', errorMessage)

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
