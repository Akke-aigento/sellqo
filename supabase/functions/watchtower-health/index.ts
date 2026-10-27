// WATCHTOWER-HEALTH-2 — read-only health-endpoint voor Nomadix Watchtower.
//
// GET met header x-health-token. Het token staat in internal_config
// (key 'watchtower_health_token'; RLS aan zonder policies, alleen service-role).
// De beoordeling zit in _shared/watchtowerHealth.ts (getest in CI).
// Raakt geen storefront-pad en schrijft niets.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2'
import { constantTimeEquals, evaluate, worst } from '../_shared/watchtowerHealth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-health-token',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const { data: cfg, error: cfgErr } = await supabase
    .from('internal_config')
    .select('value')
    .eq('key', 'watchtower_health_token')
    .maybeSingle()
  if (cfgErr || !cfg?.value) return json({ error: 'Health token not configured' }, 500)
  const provided = req.headers.get('x-health-token') ?? ''
  if (!constantTimeEquals(provided, String(cfg.value))) return json({ error: 'Unauthorized' }, 401)

  const { data: snapshot, error } = await supabase.rpc('watchtower_health_snapshot')
  if (error) {
    return json({
      status: 'fail',
      generated_at: new Date().toISOString(),
      checks: [{ key: 'snapshot', status: 'fail', detail: error.message }],
    })
  }

  const checks = evaluate(snapshot)
  return json({
    status: worst(checks),
    generated_at: new Date().toISOString(),
    version: 'watchtower-health-2',
    checks,
    context: { last_paid_order_at: snapshot?.last_paid_order_at ?? null },
  })
})
