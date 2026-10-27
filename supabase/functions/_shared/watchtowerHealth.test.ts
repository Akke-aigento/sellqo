// WATCHTOWER-HEALTH-2 — unit tests voor de beoordeling van het gezondheidssnapshot (geen netwerk).
// Run: deno test --no-lock supabase/functions/_shared/watchtowerHealth.test.ts
import { constantTimeEquals, evaluate, worst } from './watchtowerHealth.ts'

function eq(actual: unknown, expected: unknown, msg = '') {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}\n  verwacht: ${e}\n  gekregen: ${a}`)
}
const odooOf = (s: unknown) => evaluate(s).find((c) => c.key === 'odoo_sync')!

Deno.test('leeg snapshot: alles ok', () => {
  const checks = evaluate({})
  eq(worst(checks), 'ok')
  eq(checks.map((c) => c.key), ['cron_http', 'cron_jobs', 'payments', 'odoo_sync', 'email', 'webhooks'])
})

Deno.test('Odoo: losse fouten = warn', () => {
  const c = odooOf({ odoo_sync: { failed_2h: 4, last_error: 'boom', stuck_tenants: [] } })
  eq(c.status, 'warn')
})

Deno.test('Odoo: tenant die blijft falen = fail met tenantnaam', () => {
  const checks = evaluate({ odoo_sync: { failed_2h: 40, stuck_tenants: [{ tenant: 'The Fonske Crawl', failed_hours: 3, last_error: "Invalid field 'company_type'" }] } })
  const c = checks.find((x) => x.key === 'odoo_sync')!
  eq(c.status, 'fail')
  if (!c.detail.includes('The Fonske Crawl')) throw new Error(c.detail)
  eq(worst(checks), 'fail')
})

Deno.test('cron en betaling blijven zoals in WATCHTOWER-HEALTH-1', () => {
  eq(evaluate({ cron_http_errors: { count: 1 } })[0].status, 'warn')
  eq(evaluate({ cron_http_errors: { count: 3 } })[0].status, 'fail')
  eq(evaluate({ payment_anomalies_open: 1 })[2].status, 'fail')
})

Deno.test('token-vergelijking', () => {
  eq(constantTimeEquals('abc', 'abc'), true)
  eq(constantTimeEquals('abc', 'abd'), false)
  eq(constantTimeEquals('abc', 'abcd'), false)
})
