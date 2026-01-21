import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ShopifyCredentials {
  storeUrl: string
  accessToken: string
}

// Normalize store URL to proper format
function normalizeStoreUrl(url: string): string {
  let normalized = url.trim().toLowerCase()
  
  // Remove protocol if present
  normalized = normalized.replace(/^https?:\/\//, '')
  
  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '')
  
  // If it's just the store name, add myshopify.com
  if (!normalized.includes('.')) {
    normalized = `${normalized}.myshopify.com`
  }
  
  return normalized
}

// Validate store URL format
function isValidStoreUrl(url: string): boolean {
  const normalized = normalizeStoreUrl(url)
  // Must match pattern like: store-name.myshopify.com or custom domain
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(normalized) || 
         /^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(normalized)
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { credentials } = await req.json() as { credentials: ShopifyCredentials }
    
    const { storeUrl, accessToken } = credentials

    if (!storeUrl || !accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Store URL en Access Token zijn verplicht' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!isValidStoreUrl(storeUrl)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ongeldig store URL formaat. Gebruik bijv: mijn-winkel.myshopify.com' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const normalizedUrl = normalizeStoreUrl(storeUrl)
    console.log(`Testing Shopify connection for store: ${normalizedUrl}`)

    // Test API access with shop.json endpoint
    const apiUrl = `https://${normalizedUrl}/admin/api/2024-01/shop.json`
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Shopify API error:', response.status, errorText)
      
      let errorMessage = 'Verbinding met Shopify mislukt'
      if (response.status === 401) {
        errorMessage = 'Access Token is onjuist of verlopen'
      } else if (response.status === 403) {
        errorMessage = 'Geen toegang. Controleer of de app de juiste permissies heeft.'
      } else if (response.status === 404) {
        errorMessage = 'Store niet gevonden. Controleer de URL.'
      }
      
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const shopData = await response.json()
    const shopName = shopData.shop?.name || normalizedUrl

    console.log('Shopify connection test successful for store:', shopName)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Verbinding met ${shopName} succesvol!`,
        shopName,
        shopDomain: shopData.shop?.domain,
        shopEmail: shopData.shop?.email,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error testing Shopify connection:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
