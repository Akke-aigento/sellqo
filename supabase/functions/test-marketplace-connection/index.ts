import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BOL_TOKEN_URL = 'https://login.bol.com/token'

interface BolCredentials {
  clientId: string
  clientSecret: string
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

    // Amazon testing (placeholder)
    if (marketplaceType === 'amazon') {
      // TODO: Implement Amazon SP-API testing
      return new Response(
        JSON.stringify({ success: false, error: 'Amazon integratie komt binnenkort' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
