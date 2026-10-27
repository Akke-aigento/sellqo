-- WATCHTOWER-HEALTH-2 — read-only binnenkant-gezondheid voor Nomadix Watchtower.
-- (Opvolger van branch watchtower-health-1, 10-10, die nooit gedeployd werd.)
--
-- Strikt additief: één nieuwe functie, geen tabellen, geen kolommen, geen data.
-- Alleen service-role mag hem uitvoeren; de edge function `watchtower-health`
-- roept hem aan na controle van de x-health-token (internal_config).
--
-- Het token staat NIET in deze migratie (repo is publiek). Bij uitrol eenmalig:
--   insert into public.internal_config (key, value)
--   values ('watchtower_health_token', '<random>') on conflict (key) do nothing;
--
-- DOWN (handmatig): drop function if exists public.watchtower_health_snapshot();

CREATE OR REPLACE FUNCTION public.watchtower_health_snapshot()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    -- 1. Cron-aanroepen die geen 2xx kregen (pg_net bewaart ~6 u).
    'cron_http_errors', (
      SELECT jsonb_build_object(
        'count', count(*),
        'last', max(created),
        'example', left(min(coalesce(error_msg, status_code::text || ' ' || left(content::text, 120))), 200)
      )
      FROM net._http_response
      WHERE created > now() - interval '6 hours'
        AND (status_code IS NULL OR status_code >= 400)
    ),
    -- 2. Cronjobs waarvan de laatste run in de database zelf faalde.
    'cron_failed_jobs', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('job', jobname, 'at', start_time, 'msg', left(return_message, 160))), '[]'::jsonb)
      FROM (
        SELECT DISTINCT ON (j.jobid) j.jobname, d.status, d.start_time, d.return_message
        FROM cron.job j
        JOIN cron.job_run_details d ON d.jobid = j.jobid
        WHERE j.active AND d.start_time > now() - interval '24 hours'
        ORDER BY j.jobid, d.start_time DESC
      ) last_runs
      WHERE status = 'failed'
    ),
    -- 3. Betaling op een al betaalde of gesloten post (PAY-LINK-1).
    'payment_anomalies_open', (
      SELECT count(*) FROM public.payment_anomalies WHERE resolved_at IS NULL
    ),
    -- 4. Odoo-sync. De cron draait elk uur en herprobeert mislukte documenten.
    --    stuck_tenants = tenants die in de laatste 4 u in >= 3 verschillende uren
    --    enkel 'failed' hadden en geen enkele 'synced' (Fonske 24-27 okt: 1288 fouten).
    'odoo_sync', jsonb_build_object(
      'failed_2h', (
        SELECT count(*) FROM public.odoo_invoice_sync_log
        WHERE created_at > now() - interval '2 hours' AND sync_status = 'failed'
      ),
      'last_error', (
        SELECT left(error_message, 200) FROM public.odoo_invoice_sync_log
        WHERE created_at > now() - interval '2 hours' AND sync_status = 'failed'
        ORDER BY created_at DESC LIMIT 1
      ),
      'stuck_tenants', coalesce((
        SELECT jsonb_agg(jsonb_build_object('tenant', coalesce(t.name, x.tenant_id::text), 'failed_hours', x.failed_hours, 'last_error', x.last_error) ORDER BY x.failed_hours DESC)
        FROM (
          SELECT l.tenant_id,
                 count(DISTINCT date_trunc('hour', l.created_at)) FILTER (WHERE l.sync_status = 'failed') AS failed_hours,
                 left((array_agg(l.error_message ORDER BY l.created_at DESC) FILTER (WHERE l.sync_status = 'failed'))[1], 200) AS last_error
          FROM public.odoo_invoice_sync_log l
          WHERE l.created_at > now() - interval '4 hours'
          GROUP BY l.tenant_id
          HAVING count(*) FILTER (WHERE l.sync_status = 'synced') = 0
             AND count(DISTINCT date_trunc('hour', l.created_at)) FILTER (WHERE l.sync_status = 'failed') >= 3
        ) x
        LEFT JOIN public.tenants t ON t.id = x.tenant_id
      ), '[]'::jsonb)
    ),
    -- 5. Mails: append-only log, dus per message_id de laatste status bekijken.
    'email', (
      SELECT jsonb_build_object(
        'stuck_pending', count(*) FILTER (WHERE status = 'pending' AND created_at < now() - interval '1 hour' AND created_at > now() - interval '7 days'),
        'failed_24h', count(*) FILTER (WHERE status IN ('failed', 'dlq') AND created_at > now() - interval '24 hours')
      )
      FROM (
        SELECT DISTINCT ON (message_id) message_id, status, created_at
        FROM public.email_send_log
        WHERE message_id IS NOT NULL
        ORDER BY message_id, created_at DESC
      ) latest
    ),
    -- 6. Tenant-webhooks die faalden (24 u).
    'webhook_failures_24h', (
      SELECT count(*) FROM public.webhook_deliveries
      WHERE delivered_at > now() - interval '24 hours' AND response_status >= 400
    ),
    -- 7. Laatste betaalde order (context, geen alarm).
    'last_paid_order_at', (
      SELECT max(created_at) FROM public.orders WHERE payment_status = 'paid'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.watchtower_health_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.watchtower_health_snapshot() TO service_role;

-- Controle na uitrol:
--   select public.watchtower_health_snapshot();
