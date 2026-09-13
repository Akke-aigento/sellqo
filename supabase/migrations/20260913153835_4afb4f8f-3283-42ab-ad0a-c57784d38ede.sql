do $$
declare
  v_base    text    := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/';
  v_timeout integer := 120000;
  v_job     record;
  v_jobid   bigint;
  v_headers text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron ontbreekt — deze migratie hoort niet op deze database';
  end if;

  if not exists (select 1 from public.internal_config where key = 'internal_webhook_secret') then
    raise exception 'internal_config.internal_webhook_secret ontbreekt; zonder dat secret geven de functies 401';
  end if;

  for v_job in
    select * from (values
      -- jobnaam                                functie                            body (SQL-expressie)                                   auth
      ('marketplace-sync-scheduler',            'marketplace-sync-scheduler',      $b$'{}'::jsonb$b$,                                     'secret'),
      ('auto-invoice-cron',                     'auto-invoice-cron',               $b$'{}'::jsonb$b$,                                     'secret'),
      ('update-bol-tracking-every-5min',        'update-bol-tracking',             $b$'{"batch": true}'::jsonb$b$,                        'secret'),
      ('sync-bol-inventory-every-30min',        'sync-bol-inventory',              $b$'{}'::jsonb$b$,                                     'secret'),
      ('poll-tracking-status-every-30min',      'poll-tracking-status',            $b$concat('{"time": "', now(), '"}')::jsonb$b$,        'secret'),
      ('expire-unpaid-orders-daily',            'expire-orders',                   $b$'{}'::jsonb$b$,                                     'secret'),
      ('sync-odoo-invoices-hourly',             'sync-odoo-invoices',              $b$jsonb_build_object('trigger','cron','ts', now())$b$, 'secret'),
      ('generate-subscription-invoices-daily',  'generate-subscription-invoices',  $b$'{}'::jsonb$b$,                                     'vault'),
      ('process-invoice-dunning-daily',         'process-invoice-dunning',         $b$'{}'::jsonb$b$,                                     'vault'),
      ('process-cycle-reminders-daily',         'process-cycle-reminders',         $b$'{"source":"cron"}'::jsonb$b$,                      'vault'),
      ('check-expired-trials-daily',            'check-expired-trials',            $b$'{"source":"cron"}'::jsonb$b$,                      'vault')
    ) as t(jobname, fn, body_sql, auth)
  loop
    select jobid into v_jobid from cron.job where jobname = v_job.jobname;

    if v_jobid is null then
      raise notice 'cron-job % bestaat niet — overgeslagen', v_job.jobname;
      continue;
    end if;

    if v_job.auth = 'secret' then
      v_headers := $h$jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'internal_webhook_secret')
        )$h$;
    else
      -- Ongewijzigd ten opzichte van de bestaande jobs: de service-key uit de vault,
      -- plus de Lovable-Context-header die drie van de vier al meestuurden.
      v_headers := $h$jsonb_build_object(
          'Content-Type', 'application/json',
          'Lovable-Context', 'cron',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key'
          )
        )$h$;
    end if;

    perform cron.alter_job(
      v_jobid,
      command := format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := %s,
        body := %s,
        timeout_milliseconds := %s
      ) AS request_id;
    $cmd$, v_base || v_job.fn, v_headers, v_job.body_sql, v_timeout)
    );
  end loop;
end $$;