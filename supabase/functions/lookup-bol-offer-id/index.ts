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
  sellerId?: string
  accessToken?: string
  tokenExpiry?: string
}

interface LookupRequest {
  ean: string
  tenant_id: string
  connection_id: string
  product_id?: string
}

interface BolOffer {
  offerId: string
  retailerId: string
  countryCode: string
  productTitle?: string
}

interface BolOffersResponse {
  offers: BolOffer[]
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body: LookupRequest = await req.json()
    const { ean, tenant_id, connection_id, product_id } = body

    if (!ean || !tenant_id || !connection_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: ean, tenant_id, connection_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Looking up Offer ID for EAN: ${ean}`)

    // Get the marketplace connection
    const { data: connection, error: connError } = await supabase
      .from('marketplace_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('tenant_id', tenant_id)
      .single()

    if (connError || !connection) {
      console.error('Connection not found:', connError)
      return new Response(
        JSON.stringify({ success: false, error: 'Marketplace connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const credentials = connection.credentials as BolCredentials

    // Get OAuth token
    const accessToken = await getBolAccessToken(credentials)
    console.log('Successfully obtained access token')

    // Call Bol.com API to get offers for this EAN
    // Note: The endpoint structure may vary - using products/{ean}/offers
    const bolResponse = await fetch(
      `${BOL_API_BASE}/products/${ean}/offers?country-code=NL`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.retailer.v10+json'
        }
      }
    )

    if (!bolResponse.ok) {
      const errorText = await bolResponse.text()
      console.error('Bol.com API error:', bolResponse.status, errorText)
      
      // 404 means no offers found for this EAN
      if (bolResponse.status === 404) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Geen aanbiedingen gevonden voor deze EAN op Bol.com',
            offerId: null 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ success: false, error: `Bol.com API error: ${bolResponse.statusText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const offersData: BolOffersResponse = await bolResponse.json()
    console.log(`Found ${offersData.offers?.length || 0} offers for EAN ${ean}`)

    if (!offersData.offers || offersData.offers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Geen aanbiedingen gevonden voor deze EAN',
          offerId: null 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Filter to find OUR offer (matching retailer ID)
    const sellerId = credentials.sellerId
    let matchingOffer: BolOffer | undefined

    if (sellerId) {
      matchingOffer = offersData.offers.find(offer => offer.retailerId === sellerId)
    } else {
      // If no sellerId configured, just take the first offer (assumes single retailer)
      // This is a fallback - ideally sellerId should be configured
      matchingOffer = offersData.offers[0]
      console.log('Warning: No sellerId configured, using first offer found')
    }

    if (!matchingOffer) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Geen aanbieding gevonden die hoort bij jouw verkopersaccount',
          offerId: null 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const offerId = matchingOffer.offerId
    console.log(`Found matching offer ID: ${offerId}`)

    // If product_id is provided, update the product's marketplace_mappings
    if (product_id) {
      // First get current product
      const { data: product, error: prodError } = await supabase
        .from('products')
        .select('marketplace_mappings')
        .eq('id', product_id)
        .single()

      if (prodError) {
        console.error('Error fetching product:', prodError)
      } else {
        // Update marketplace mappings
        const currentMappings = (product?.marketplace_mappings || {}) as Record<string, unknown>
        const updatedMappings = {
          ...currentMappings,
          bol_com: {
            offerId,
            lastSync: new Date().toISOString(),
            autoLinked: true
          }
        }

        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            marketplace_mappings: updatedMappings,
            bol_offer_id: offerId  // Also store in dedicated field
          })
          .eq('id', product_id)

        if (updateError) {
          console.error('Error updating product:', updateError)
        } else {
          console.log(`Successfully saved offer ID to product ${product_id}`)
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        offerId,
        productTitle: matchingOffer.productTitle,
        autoLinked: !!product_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in lookup-bol-offer-id:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
