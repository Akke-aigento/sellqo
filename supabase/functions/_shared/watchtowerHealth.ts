// WATCHTOWER-HEALTH-2 — beoordeling van het SellQo-gezondheidssnapshot voor Nomadix Watchtower.
//
// Puur en netwerkloos, zodat CI het kan testen. De edge function `watchtower-health`
// haalt het snapshot op (rpc watchtower_health_snapshot) en geeft het hier door.
// Contract naar Watchtower: { status: 'ok'|'warn'|'fail', generated_at, checks: [{ key, status, detail }] }.
// Watchtower maakt van 'fail' na 2 metingen een actie-incident met push.

export type Status = 'ok' | 'warn' | 'fail'
export type Check = { key: string; status: Status; detail: string }

const RANK: Record<Status, number> = { ok: 0, warn: 1, fail: 2 }

export function worst(checks: Check[]): Status {
  return checks.reduce<Status>((acc, c) => (RANK[c.status] > RANK[acc] ? c.status : acc), 'ok')
}

interface OdooStuckTenant { tenant: string; failed_hours: number; last_error?: string | null }

// deno-lint-ignore no-explicit-any
export function evaluate(s: any): Check[] {
  const checks: Check[] = []

  const http = s?.cron_http_errors ?? {}
  const httpCount = Number(http.count ?? 0)
  checks.push({
    key: 'cron_http',
    status: httpCount >= 3 ? 'fail' : httpCount > 0 ? 'warn' : 'ok',
    detail: httpCount ? `${httpCount} cron-aanroep(en) zonder 2xx in 6 u — ${http.example ?? ''}` : 'alle cron-aanroepen 2xx (6 u)',
  })

  const failed = Array.isArray(s?.cron_failed_jobs) ? s.cron_failed_jobs : []
  checks.push({
    key: 'cron_jobs',
    status: failed.length ? 'fail' : 'ok',
    detail: failed.length ? `laatste run faalde: ${failed.map((f: { job: string }) => f.job).join(', ')}` : 'alle actieve cronjobs ok (24 u)',
  })

  const anomalies = Number(s?.payment_anomalies_open ?? 0)
  checks.push({
    key: 'payments',
    status: anomalies > 0 ? 'fail' : 'ok',
    detail: anomalies ? `${anomalies} betaling(en) op een al betaalde of gesloten post — terugbetalen?` : 'geen betaalanomalieën',
  })

  // Odoo: 'fail' als een tenant in de laatste 4 u in minstens 3 verschillende uren
  // enkel mislukte syncs had (de cron draait elk uur). Losse fouten (2 u) = 'warn'.
  // Aanleiding: 24-27 okt faalde de Fonske-sync 1288 keer zonder dat iemand het zag.
  const odoo = s?.odoo_sync ?? {}
  const stuck: OdooStuckTenant[] = Array.isArray(odoo.stuck_tenants) ? odoo.stuck_tenants : []
  const recent = Number(odoo.failed_2h ?? 0)
  if (stuck.length) {
    checks.push({
      key: 'odoo_sync',
      status: 'fail',
      detail: `Odoo-sync ligt stil voor ${stuck.map((t) => t.tenant).join(', ')} (${stuck[0].failed_hours} uur na elkaar enkel fouten): ${stuck[0].last_error ?? ''}`.trim(),
    })
  } else {
    checks.push({
      key: 'odoo_sync',
      status: recent > 0 ? 'warn' : 'ok',
      detail: recent ? `${recent} Odoo-boeking(en) mislukt (2 u): ${odoo.last_error ?? ''}`.trim() : 'Odoo-sync ok (2 u)',
    })
  }

  const mail = s?.email ?? {}
  const stuckMail = Number(mail.stuck_pending ?? 0)
  const mailFailed = Number(mail.failed_24h ?? 0)
  checks.push({
    key: 'email',
    status: mailFailed > 0 ? 'fail' : stuckMail > 0 ? 'warn' : 'ok',
    detail: mailFailed || stuckMail ? `${mailFailed} mislukt/DLQ (24 u), ${stuckMail} hangt > 1 u op pending` : 'geen mislukte of hangende mails',
  })

  const wh = Number(s?.webhook_failures_24h ?? 0)
  checks.push({
    key: 'webhooks',
    status: wh > 0 ? 'warn' : 'ok',
    detail: wh ? `${wh} tenant-webhook(s) faalden (24 u)` : 'tenant-webhooks ok (24 u)',
  })

  return checks
}

/** Tijdsgelijke vergelijking van het health-token. */
export function constantTimeEquals(a: string, b: string): boolean {
  let mismatch = a.length !== b.length ? 1 : 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}
