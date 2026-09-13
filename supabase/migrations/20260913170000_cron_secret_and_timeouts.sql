-- CRON-AUTH-1 — elf cron-jobs: het cron-secret in plaats van de publieke
-- anon-sleutel, en een HTTP-timeout die het antwoord laat aankomen.
--
-- WAAROM, DEEL 1 — AUTH. Zeven jobs stuurden de anon-JWT letterlijk mee
-- ("Authorization: Bearer eyJ…", role=anon, nagetrokken 13 sep 2026 door de
-- payload te decoderen). Die sleutel is publiek — hij zit in de webapp — en
-- bewees dus niets. Het werkte alleen omdat de functies erachter helemaal niets
-- controleerden. Sinds CRON-AUTH-1 weigeren die functies elke aanroep zonder
-- `x-cron-secret` of service-key (_shared/cronAuth.ts), dus deze jobs moeten het
-- secret sturen. Het wordt bij elke run opgezocht in internal_config en staat
-- niet als tekst in cron.job.command — hetzelfde patroon als de ads-jobs
-- (20260912140000).
--
-- De vier jobs die de service-key uit de vault halen, houden die header. Ze
-- krijgen alleen de timeout.
--
-- WAAROM, DEEL 2 — TIMEOUT. net.http_post heeft timeout_milliseconds DEFAULT
-- 5000. update-bol-tracking liep daar elke run tegenaan, marketplace-sync-scheduler
-- ongeveer de helft en sync-bol-inventory elke run. Het werk kwam wel klaar (de
-- voorraadsync logde om 14:40:12 nog, twaalf seconden na de start), maar het
-- antwoord — en dus elke foutmelding — ging verloren.
--
-- VOLGORDE BIJ UITROL: deze migratie VÓÓR het deployen van de functies. De oude
-- functies negeren de nieuwe header; de nieuwe weigeren de oude. Omgekeerd liggen
-- de syncs stil tot de migratie draait.
--
-- WAAROM cron.alter_job: cron.schedule met een sub-hourly schema wordt door een
-- platform-guard geblokkeerd, en UPDATE cron.job geeft permission denied (zie
-- 20260912140000). alter_job raakt alleen het commando; naam en schema blijven.
--
-- IDEMPOTENT: elk commando wordt volledig opnieuw opgebouwd, niet aangevuld.
-- Een ontbrekende job wordt overgeslagen met een notice.
--
-- TERUGDRAAIEN: niet naar de anon-sleutel — die gaan de nieuwe functies weigeren.
-- Wie de timeout terug wil, draait deze migratie met v_timeout := 5000.

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
