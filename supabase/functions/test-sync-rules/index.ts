import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestSyncRequest {
  connectionId: string
  dataType: 'orders' | 'products' | 'inventory' | 'customers'
  direction: 'import' | 'export'
  sampleSize?: number
}

interface TestResult {
  success: boolean
  dataType: string
  direction: string
  sampleSize: number
  wouldProcess: number
  wouldCreate: number
  wouldUpdate: number
  wouldSkip: number
  validationErrors: string[]
  sampleRecords: Array<{
    id: string
    action: 'create' | 'update' | 'skip'
    reason?: string
    preview?: Record<string, unknown>
  }>
  estimatedDuration: string
  warnings: string[]
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
    const { connectionId, dataType, direction, sampleSize = 10 } = await req.json() as TestSyncRequest

    if (!connectionId || !dataType) {
      return new Response(
        JSON.stringify({ success: false, error: 'connectionId and dataType are required' }),
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
      throw new Error('Connection not found')
    }

    const platformType = connection.marketplace_type as string
    const tenantId = connection.tenant_id as string

    // Initialize test result
    const result: TestResult = {
      success: true,
      dataType,
      direction,
      sampleSize,
      wouldProcess: 0,
      wouldCreate: 0,
      wouldUpdate: 0,
      wouldSkip: 0,
      validationErrors: [],
      sampleRecords: [],
      estimatedDuration: '< 1 min',
      warnings: [],
    }

    // Simulate based on platform and data type
    if (direction === 'import') {
      // Simulate import - check what would be fetched from external platform
      result.warnings.push(`Dit is een simulatie - geen data wordt daadwerkelijk opgehaald van ${platformType}`)

      // Get existing records count to estimate creates vs updates
      let existingCount = 0
      
      if (dataType === 'orders') {
        const { count } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('source', platformType)
        existingCount = count || 0
      } else if (dataType === 'products') {
        const { count } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
        existingCount = count || 0
      } else if (dataType === 'customers') {
        const { count } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
        existingCount = count || 0
      }

      // Simulate sample records
      const simulatedTotal = Math.floor(Math.random() * 50) + 10
      result.wouldProcess = simulatedTotal

      for (let i = 0; i < Math.min(sampleSize, simulatedTotal); i++) {
        const isExisting = i < existingCount && Math.random() > 0.3
        const action = isExisting ? 'update' : 'create'
        
        if (action === 'create') result.wouldCreate++
        else result.wouldUpdate++

        result.sampleRecords.push({
          id: `sample-${i + 1}`,
          action,
          preview: {
            [`${dataType.slice(0, -1)}_id`]: `EXT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            status: 'pending_import',
            source: platformType,
          }
        })
      }

      // Add platform-specific validation warnings
      if (platformType === 'bol_com') {
        if (dataType === 'products') {
          result.warnings.push('Bol.com vereist EAN codes - producten zonder EAN worden overgeslagen')
        }
        if (dataType === 'orders') {
          result.warnings.push('Alleen bestellingen van de laatste 3 maanden worden geïmporteerd')
        }
      }

      if (platformType === 'amazon') {
        result.warnings.push('Amazon rate limits: maximaal 1 request per 2 seconden')
      }

      // Estimate duration
      if (result.wouldProcess > 100) {
        result.estimatedDuration = '5-10 min'
      } else if (result.wouldProcess > 50) {
        result.estimatedDuration = '2-5 min'
      } else {
        result.estimatedDuration = '< 2 min'
      }

    } else {
      // Simulate export - check what would be sent to external platform
      result.warnings.push(`Dit is een simulatie - geen data wordt daadwerkelijk verzonden naar ${platformType}`)

      // Get records that would be exported
      let records: Array<{ id: string; name?: string; sku?: string }> = []

      if (dataType === 'products') {
        const { data } = await supabase
          .from('products')
          .select('id, name, sku, ean')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .limit(sampleSize)

        records = data || []

        // Check for missing required fields
        for (const product of records) {
          const hasIssue = platformType === 'bol_com' && !(product as any).ean
          
          result.sampleRecords.push({
            id: product.id,
            action: hasIssue ? 'skip' : 'update',
            reason: hasIssue ? 'Ontbrekende EAN code (vereist voor Bol.com)' : undefined,
            preview: {
              name: product.name,
              sku: product.sku,
            }
          })

          if (hasIssue) {
            result.wouldSkip++
            if (!result.validationErrors.includes('Sommige producten missen verplichte velden')) {
              result.validationErrors.push('Sommige producten missen verplichte velden')
            }
          } else {
            result.wouldUpdate++
          }
        }

        result.wouldProcess = records.length
      } else if (dataType === 'inventory') {
        const { data } = await supabase
          .from('products')
          .select('id, name, sku, stock')
          .eq('tenant_id', tenantId)
          .eq('track_inventory', true)
          .limit(sampleSize)

        records = data || []

        for (const product of records) {
          result.sampleRecords.push({
            id: product.id,
            action: 'update',
            preview: {
              name: product.name,
              sku: product.sku,
              stock: (product as any).stock,
            }
          })
          result.wouldUpdate++
        }

        result.wouldProcess = records.length
      }

      // Estimate duration for export
      if (result.wouldProcess > 50) {
        result.estimatedDuration = '3-5 min'
      } else {
        result.estimatedDuration = '< 2 min'
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Test sync error:', errorMessage)

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
