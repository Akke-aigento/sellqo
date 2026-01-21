import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BOL_TOKEN_URL = 'https://login.bol.com/token'
const AMAZON_LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token'

interface BolCredentials {
  clientId: string
  clientSecret: string
}

interface AmazonCredentials {
  sellerId: string
  clientId: string
  clientSecret: string
  refreshToken: string
  marketplaceId?: string
}

// Amazon Marketplace IDs
const AMAZON_MARKETPLACES: Record<string, { id: string; endpoint: string; name: string }> = {
  'nl': { id: 'A1805IZSGTT6HS', endpoint: 'sellingpartnerapi-eu.amazon.com', name: 'Amazon.nl' },
  'de': { id: 'A1PA6795UKMFR9', endpoint: 'sellingpartnerapi-eu.amazon.com', name: 'Amazon.de' },
  'fr': { id: 'A13V1IB3VIYZZH', endpoint: 'sellingpartnerapi-eu.amazon.com', name: 'Amazon.fr' },
  'be': { id: 'AMEN7PMS3EDWL', endpoint: 'sellingpartnerapi-eu.amazon.com', name: 'Amazon.be' },
  'uk': { id: 'A1F83G8C2ARO7P', endpoint: 'sellingpartnerapi-eu.amazon.com', name: 'Amazon.co.uk' },
  'es': { id: 'A1RKKUPIHCS9HS', endpoint: 'sellingpartnerapi-eu.amazon.com', name: 'Amazon.es' },
  'it': { id: 'APJ6JRA9NG5V4', endpoint: 'sellingpartnerapi-eu.amazon.com', name: 'Amazon.it' },
  'us': { id: 'ATVPDKIKX0DER', endpoint: 'sellingpartnerapi-na.amazon.com', name: 'Amazon.com' },
}

async function testAmazonConnection(credentials: AmazonCredentials): Promise<{ success: boolean; error?: string; marketplaceName?: string }> {
  const { clientId, clientSecret, refreshToken, marketplaceId = 'nl' } = credentials

  if (!clientId || !clientSecret || !refreshToken) {
    return { success: false, error: 'Client ID, Client Secret en Refresh Token zijn verplicht' }
  }

  const marketplace = AMAZON_MARKETPLACES[marketplaceId] || AMAZON_MARKETPLACES['nl']

  try {
    // Step 1: Get LWA access token using refresh token
    const tokenResponse = await fetch(AMAZON_LWA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      console.error('Amazon LWA token error:', errorData)
      
      if (errorData.error === 'invalid_client') {
        return { success: false, error: 'Client ID of Client Secret is onjuist' }
      }
      if (errorData.error === 'invalid_grant') {
        return { success: false, error: 'Refresh Token is ongeldig of verlopen. Genereer een nieuwe in Seller Central.' }
      }
      
      return { success: false, error: `LWA authenticatie mislukt: ${errorData.error_description || errorData.error || 'Onbekende fout'}` }
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Step 2: Test SP-API with a simple call (get marketplace participations)
    const spApiUrl = `https://${marketplace.endpoint}/sellers/v1/marketplaceParticipations`
    
    const spApiResponse = await fetch(spApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!spApiResponse.ok) {
      const errorText = await spApiResponse.text()
      console.error('Amazon SP-API error:', errorText)
      
      if (spApiResponse.status === 403) {
        return { success: false, error: 'Geen toegang tot de SP-API. Controleer je app permissies in Seller Central.' }
      }
      if (spApiResponse.status === 401) {
        return { success: false, error: 'Authenticatie mislukt. Controleer je credentials.' }
      }
      
      return { success: false, error: `SP-API fout (${spApiResponse.status}): ${errorText.substring(0, 200)}` }
    }

    // Success!
    console.log('Amazon connection test successful for marketplace:', marketplace.name)
    
    return { 
      success: true, 
      marketplaceName: marketplace.name 
    }

  } catch (error) {
    console.error('Amazon connection test error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Verbinding met Amazon mislukt' 
    }
  }
}

// Shopify connection test
interface ShopifyCredentials {
  storeUrl: string
  accessToken: string
}

function normalizeStoreUrl(url: string): string {
  let normalized = url.trim().toLowerCase()
  normalized = normalized.replace(/^https?:\/\//, '')
  normalized = normalized.replace(/\/+$/, '')
  if (!normalized.includes('.')) {
    normalized = `${normalized}.myshopify.com`
  }
  return normalized
}

async function testShopifyConnection(credentials: ShopifyCredentials): Promise<{ success: boolean; error?: string; shopName?: string }> {
  const { storeUrl, accessToken } = credentials

  if (!storeUrl || !accessToken) {
    return { success: false, error: 'Store URL en Access Token zijn verplicht' }
  }

  const normalizedUrl = normalizeStoreUrl(storeUrl)

  try {
    const apiUrl = `https://${normalizedUrl}/admin/api/2024-01/shop.json`
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Access Token is onjuist of verlopen' }
      }
      if (response.status === 403) {
        return { success: false, error: 'Geen toegang. Controleer of de app de juiste permissies heeft.' }
      }
      if (response.status === 404) {
        return { success: false, error: 'Store niet gevonden. Controleer de URL.' }
      }
      return { success: false, error: `Shopify API fout: ${response.status}` }
    }

    const shopData = await response.json()
    return { 
      success: true, 
      shopName: shopData.shop?.name || normalizedUrl 
    }

  } catch (error) {
    console.error('Shopify connection test error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Verbinding met Shopify mislukt' 
    }
  }
}

// WooCommerce connection test
interface WooCommerceCredentials {
  siteUrl: string
  consumerKey: string
  consumerSecret: string
}

function normalizeSiteUrl(url: string): string {
  let normalized = url.trim()
  normalized = normalized.replace(/\/+$/, '')
  if (!normalized.startsWith('http')) {
    normalized = `https://${normalized}`
  }
  return normalized
}

async function testWooCommerceConnection(credentials: WooCommerceCredentials): Promise<{ success: boolean; error?: string; shopName?: string }> {
  const { siteUrl, consumerKey, consumerSecret } = credentials

  if (!siteUrl || !consumerKey || !consumerSecret) {
    return { success: false, error: 'Site URL, Consumer Key en Consumer Secret zijn verplicht' }
  }

  const normalizedUrl = normalizeSiteUrl(siteUrl)

  try {
    // Test with /wp-json/wc/v3/system_status (requires read permissions)
    const apiUrl = `${normalizedUrl}/wp-json/wc/v3/system_status`
    
    // WooCommerce uses Basic Auth with consumer key/secret
    const authString = btoa(`${consumerKey}:${consumerSecret}`)
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Consumer Key of Secret is onjuist' }
      }
      if (response.status === 403) {
        return { success: false, error: 'Geen toegang. Controleer de API permissies (Lezen/Schrijven vereist).' }
      }
      if (response.status === 404) {
        return { success: false, error: 'WooCommerce API niet gevonden. Is WooCommerce actief op deze site?' }
      }
      return { success: false, error: `WooCommerce API fout: ${response.status}` }
    }

    const data = await response.json()
    console.log('WooCommerce connection test successful')
    
    return { 
      success: true, 
      shopName: data.environment?.site_url || normalizedUrl 
    }

  } catch (error) {
    console.error('WooCommerce connection test error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Verbinding met WooCommerce mislukt' 
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { marketplaceType, credentials } = await req.json()

    console.log(`Testing connection for marketplace: ${marketplaceType}`)

    if (marketplaceType === 'bol_com') {
      const { clientId, clientSecret } = credentials as BolCredentials

      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ success: false, error: 'Client ID en Client Secret zijn verplicht' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Try to get an access token
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
        const errorData = await response.json().catch(() => ({}))
        console.error('Bol.com auth failed:', errorData)
        
        let errorMessage = 'Ongeldige credentials'
        if (response.status === 401) {
          errorMessage = 'Client ID of Client Secret is onjuist'
        } else if (response.status === 403) {
          errorMessage = 'Geen toegang tot de Bol.com API. Controleer je account rechten.'
        }
        
        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const tokenData = await response.json()
      
      console.log('Bol.com connection test successful')
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Verbinding succesvol!',
          expiresIn: tokenData.expires_in
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Amazon SP-API testing
    if (marketplaceType === 'amazon') {
      const result = await testAmazonConnection(credentials as AmazonCredentials)
      
      if (result.success) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Verbinding met ${result.marketplaceName} succesvol!`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        return new Response(
          JSON.stringify({ success: false, error: result.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Shopify testing
    if (marketplaceType === 'shopify') {
      const result = await testShopifyConnection(credentials as ShopifyCredentials)
      
      if (result.success) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Verbinding met ${result.shopName} succesvol!`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        return new Response(
          JSON.stringify({ success: false, error: result.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // WooCommerce testing
    if (marketplaceType === 'woocommerce') {
      const result = await testWooCommerceConnection(credentials as WooCommerceCredentials)
      
      if (result.success) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Verbinding met ${result.shopName} succesvol!`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        return new Response(
          JSON.stringify({ success: false, error: result.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Onbekend marketplace type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error testing connection:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
