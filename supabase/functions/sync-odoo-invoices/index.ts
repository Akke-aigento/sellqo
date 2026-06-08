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
  error?: { code: number; message: string; data?: { message: string } }
}

function normalizeOdooUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, '')
  if (!normalized.startsWith('http')) normalized = `https://${normalized}`
  return normalized
}

async function odooAuthenticate(credentials: OdooCredentials): Promise<{ uid: number; sessionId: string } | null> {
  const normalizedUrl = normalizeOdooUrl(credentials.odooUrl)
  const response = await fetch(`${normalizedUrl}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: credentials.odooDatabase, login: credentials.odooUsername, password: credentials.odooApiKey },
      id: 1,
    }),
  })

  const data: OdooJsonRpcResponse = await response.json()
  const result = data.result as { uid?: number } | null
  if (!result?.uid) return null

  const cookies = response.headers.get('set-cookie') || ''
  const sessionMatch = cookies.match(/session_id=([^;]+)/)
  return { uid: result.uid, sessionId: sessionMatch?.[1] || '' }
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
    headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs }, id: Date.now() }),
  })

  const data: OdooJsonRpcResponse = await response.json()
  if (data.error) throw new Error(data.error.data?.message || data.error.message)
  return data.result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { connectionId, invoiceIds } = await req.json()

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

    if (connError || !connection) throw new Error('Connection not found')

    const credentials = connection.credentials as OdooCredentials
    const settings = connection.settings as { 
      odooDefaultJournalId?: string
      odooAutoConfirmInvoices?: boolean
      odooModuleAccounting?: boolean
    }

    // Check if accounting module is enabled
    if (settings.odooModuleAccounting === false) {
      console.log('Odoo accounting module not enabled, skipping invoice sync')
      return new Response(
        JSON.stringify({ success: true, invoicesSynced: 0, message: 'Accounting module not enabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Authenticate with Odoo
    const auth = await odooAuthenticate(credentials)
    if (!auth) throw new Error('Odoo authentication failed')

    // Load tenant Odoo settings (B2C aggregation toggle)
    const { data: odooSettings } = await supabase
      .from('tenant_odoo_settings')
      .select('aggregate_b2c_customers, b2c_dummy_partner_name, b2c_dummy_partner_odoo_id')
      .eq('tenant_id', connection.tenant_id)
      .maybeSingle()

    const aggregateB2C = odooSettings?.aggregate_b2c_customers === true
    let dummyPartnerId: number | null = odooSettings?.b2c_dummy_partner_odoo_id ?? null
    const dummyPartnerName = odooSettings?.b2c_dummy_partner_name || 'Diverse particulieren'

    // Lazily ensure the B2C dummy res.partner exists (only when aggregation is on)
    const ensureDummyPartner = async (): Promise<number> => {
      if (dummyPartnerId) return dummyPartnerId
      const existing = await odooCallMethod(
        credentials,
        auth.sessionId,
        'res.partner',
        'search',
        [[['name', '=', dummyPartnerName], ['customer_rank', '>', 0]]],
        { limit: 1 }
      ) as number[]

      if (existing.length > 0) {
        dummyPartnerId = existing[0]
      } else {
        dummyPartnerId = await odooCallMethod(
          credentials,
          auth.sessionId,
          'res.partner',
          'create',
          [{
            name: dummyPartnerName,
            company_type: 'person',
            customer_rank: 1,
            comment: 'SellQo aggregated B2C consumer sales — individual customers anonymized in accounting',
          }]
        ) as number
      }

      await supabase
        .from('tenant_odoo_settings')
        .update({ b2c_dummy_partner_odoo_id: dummyPartnerId })
        .eq('tenant_id', connection.tenant_id)

      return dummyPartnerId
    }

    // Get invoices to sync
    let invoicesQuery = supabase
      .from('invoices')
      .select('*, order:orders(*, order_items(*))')
      .eq('tenant_id', connection.tenant_id)

    if (invoiceIds?.length) {
      invoicesQuery = invoicesQuery.in('id', invoiceIds)
    } else {
      // Get unsynced invoices (no odoo_move_id in sync log with success status)
      const { data: syncedIds } = await supabase
        .from('odoo_invoice_sync_log')
        .select('invoice_id')
        .eq('marketplace_connection_id', connectionId)
        .eq('sync_status', 'synced')

      const syncedInvoiceIds = (syncedIds || []).map(s => s.invoice_id).filter(Boolean)
      
      if (syncedInvoiceIds.length > 0) {
        invoicesQuery = invoicesQuery.not('id', 'in', `(${syncedInvoiceIds.join(',')})`)
      }
    }

    const { data: invoices, error: invoicesError } = await invoicesQuery.limit(50)
    if (invoicesError) throw invoicesError

    let syncedCount = 0
    const errors: string[] = []

    for (const invoice of invoices || []) {
      try {
        const customerName = invoice.order?.customer_name || 'Onbekende klant'
        const customerEmail = invoice.order?.customer_email || ''

        // Determine customer type. Prefer the linked customer record; fall back to order heuristics.
        let customerType: 'b2b' | 'b2c' = 'b2c'
        if (invoice.order?.customer_id) {
          const { data: cust } = await supabase
            .from('customers')
            .select('customer_type')
            .eq('id', invoice.order.customer_id)
            .maybeSingle()
          if (cust?.customer_type === 'b2b') customerType = 'b2b'
        } else if (invoice.order?.customer_vat_number || invoice.order?.customer_company_name) {
          customerType = 'b2b'
        }

        let partnerId: number
        let auditNote: string | null = null

        if (aggregateB2C && customerType === 'b2c') {
          // Route B2C invoice to the shared dummy partner; keep audit info in invoice narration
          partnerId = await ensureDummyPartner()
          auditNote = `SellQo customer: ${customerName}${customerEmail ? ` <${customerEmail}>` : ''} (order ${invoice.order?.order_number || invoice.order?.id || ''})`
        } else {
          // B2B or aggregation off → existing per-customer behaviour
          const existingPartners = customerEmail
            ? await odooCallMethod(
                credentials,
                auth.sessionId,
                'res.partner',
                'search',
                [[['email', '=', customerEmail]]],
                { limit: 1 }
              ) as number[]
            : []

          if (existingPartners.length > 0) {
            partnerId = existingPartners[0]
          } else {
            partnerId = await odooCallMethod(
              credentials,
              auth.sessionId,
              'res.partner',
              'create',
              [{
                name: customerName,
                email: customerEmail || false,
                phone: invoice.order?.customer_phone || false,
                street: invoice.order?.billing_address?.street || false,
                city: invoice.order?.billing_address?.city || false,
                zip: invoice.order?.billing_address?.postal_code || false,
                customer_rank: 1,
              }]
            ) as number
          }
        }

        // Create invoice (account.move) in Odoo
        const invoiceLines = (invoice.order?.order_items || []).map((item: { product_name: string; quantity: number; unit_price: number }) => [
          0, 0, {
            name: item.product_name,
            quantity: item.quantity,
            price_unit: item.unit_price,
          }
        ])

        const moveData: Record<string, unknown> = {
          move_type: 'out_invoice',
          partner_id: partnerId,
          invoice_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
          ref: invoice.invoice_number,
          invoice_line_ids: invoiceLines,
        }

        if (auditNote) {
          moveData.narration = auditNote
        }

        if (settings.odooDefaultJournalId) {
          moveData.journal_id = parseInt(settings.odooDefaultJournalId)
        }

        const moveId = await odooCallMethod(
          credentials,
          auth.sessionId,
          'account.move',
          'create',
          [moveData]
        ) as number

        // Optionally confirm/post the invoice
        if (settings.odooAutoConfirmInvoices) {
          await odooCallMethod(
            credentials,
            auth.sessionId,
            'account.move',
            'action_post',
            [[moveId]]
          )
        }

        // Log the sync
        await supabase.from('odoo_invoice_sync_log').insert({
          tenant_id: connection.tenant_id,
          marketplace_connection_id: connectionId,
          invoice_id: invoice.id,
          odoo_move_id: moveId.toString(),
          sync_status: 'synced',
          sync_direction: 'push',
          synced_at: new Date().toISOString(),
        })

        syncedCount++
        console.log(`Synced invoice ${invoice.invoice_number} to Odoo as move ${moveId}`)

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`Invoice ${invoice.invoice_number}: ${errorMessage}`)

        await supabase.from('odoo_invoice_sync_log').insert({
          tenant_id: connection.tenant_id,
          marketplace_connection_id: connectionId,
          invoice_id: invoice.id,
          sync_status: 'failed',
          sync_direction: 'push',
          error_message: errorMessage,
          synced_at: new Date().toISOString(),
        })
      }
    }

    // Update connection last_sync_at
    await supabase
      .from('marketplace_connections')
      .update({ last_sync_at: new Date().toISOString(), last_error: errors.length > 0 ? errors[0] : null })
      .eq('id', connectionId)

    return new Response(
      JSON.stringify({ success: true, invoicesSynced: syncedCount, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error syncing invoices to Odoo:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
