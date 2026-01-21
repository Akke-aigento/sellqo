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
    data?: {
      name: string
      message: string
    }
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

async function testOdooConnection(credentials: OdooCredentials): Promise<{ success: boolean; error?: string; companyName?: string; version?: string }> {
  const { odooUrl, odooDatabase, odooUsername, odooApiKey } = credentials

  if (!odooUrl || !odooDatabase || !odooUsername || !odooApiKey) {
    return { success: false, error: 'Odoo URL, Database, Gebruikersnaam en API Key zijn verplicht' }
  }

  const normalizedUrl = normalizeOdooUrl(odooUrl)

  try {
    // Step 1: Test connection with common endpoint (version_info)
    const versionResponse = await fetch(`${normalizedUrl}/web/session/get_session_info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {},
        id: 1,
      }),
    })

    if (!versionResponse.ok && versionResponse.status === 404) {
      return { success: false, error: 'Odoo URL niet gevonden. Controleer of de URL correct is.' }
    }

    // Step 2: Authenticate with Odoo using JSON-RPC
    const authResponse = await fetch(`${normalizedUrl}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: odooDatabase,
          login: odooUsername,
          password: odooApiKey,
        },
        id: 2,
      }),
    })

    if (!authResponse.ok) {
      return { success: false, error: `Odoo server fout: ${authResponse.status}` }
    }

    const authData: OdooJsonRpcResponse = await authResponse.json()

    if (authData.error) {
      const errorMessage = authData.error.data?.message || authData.error.message
      if (errorMessage.includes('Access Denied') || errorMessage.includes('authentication')) {
        return { success: false, error: 'Gebruikersnaam of API Key is onjuist' }
      }
      if (errorMessage.includes('database') || errorMessage.includes('FATAL')) {
        return { success: false, error: 'Database niet gevonden. Controleer de databasenaam.' }
      }
      return { success: false, error: `Odoo fout: ${errorMessage}` }
    }

    const result = authData.result as { uid?: number; company_id?: number; name?: string; company_name?: string; server_version?: string } | null
    
    if (!result || !result.uid) {
      return { success: false, error: 'Authenticatie mislukt. Controleer je credentials.' }
    }

    console.log('Odoo authentication successful:', { uid: result.uid, company: result.company_name })

    return { 
      success: true, 
      companyName: result.company_name || result.name || odooDatabase,
      version: result.server_version
    }

  } catch (error) {
    console.error('Odoo connection test error:', error)
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { success: false, error: 'Kan geen verbinding maken met de Odoo server. Controleer de URL.' }
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Verbinding met Odoo mislukt' 
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { credentials } = await req.json()

    console.log('Testing Odoo connection...')

    const result = await testOdooConnection(credentials as OdooCredentials)
    
    if (result.success) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Verbinding met ${result.companyName} succesvol!`,
          version: result.version,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error testing Odoo connection:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
