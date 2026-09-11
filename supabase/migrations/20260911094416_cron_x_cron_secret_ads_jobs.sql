-- ADS-CRON-1 — vier cron-jobs op het x-cron-secret-pad zetten
--
-- Aanleiding: deze vier jobs kregen bij élke run een 401, en de bol.com-
-- advertentieautomatisering lag daardoor stil sinds 6 mei 2026. Zie
-- docs/cron-inventaris.md §3.
--
-- Twee oorzaken, allebei in de edge function:
--   * ads-bolcom-scheduler vergeleek de Authorization-header LETTERLIJK met
--     `Bearer ${SUPABASE_ANON_KEY}` uit zijn eigen runtime. De sleutel in deze
--     cron-commando's is identiek aan die in .env en in internal_config, dus de
--     afwijking zit in wat Supabase in de functieruntime injecteert.
--   * ads-inventory-watch viel terug op authenticateRequest(), dat een
--     gebruikers-JWT valideert. Een cron heeft geen gebruiker.
--
-- Beide functies gebruiken nu _shared/cronAuth.ts, dat `x-cron-secret`
-- vergelijkt met internal_config.internal_webhook_secret. Deze migratie laat de
-- jobs die header meesturen.
--
-- VOLGORDE IS EEN HARDE EIS: deploy eerst de twee edge functions, draai dan pas
-- deze migratie. Andersom stuurt de cron een header die de oude code negeert,
-- en blijft alles 401 — met het verschil dat je denkt dat het opgelost is.
--
-- Het secret wordt bij ELKE RUN opgezocht, niet bij het plannen. Zo staat het
-- niet als tekst in cron.job.command. Dat kan omdat de job als `postgres`
-- draait: die is eigenaar van internal_config, heeft rolbypassrls, en de tabel
-- forceert RLS niet (nagetrokken op 11 sep 2026).
--
-- IDEMPOTENT: cron.schedule() met een bestaande jobnaam vervangt die job.
-- Twee keer draaien geeft hetzelfde resultaat.
--
-- TERUGDRAAIEN (geen DOWN-migratie): zet de vier commando's terug op
--   headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon key>"}'::jsonb
-- met dezelfde jobnamen en schema's. De anon-sleutel staat in
-- internal_config.supabase_anon_key. Let op: dat herstelt ook de 401's.

do $$
declare
  v_base text := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/';
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron ontbreekt — deze migratie hoort niet op deze database';
  end if;

  if not exists (select 1 from public.internal_config where key = 'internal_webhook_secret') then
    raise exception 'internal_config.internal_webhook_secret ontbreekt; zonder dat secret zouden alle vier de jobs 401 blijven geven';
  end if;

  -- ads-inventory-watch — elke 15 minuten
  perform cron.schedule(
    'ads-inventory-watch-every-15min',
    '*/15 * * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'internal_webhook_secret')
        ),
        body := '{}'::jsonb
      ) AS request_id;
    $cmd$, v_base || 'ads-inventory-watch')
  );

  -- ads-bolcom-scheduler — drie jobs, drie modi
  perform cron.schedule(
    'ads-bolcom-sync-every-30min',
    '*/30 * * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'internal_webhook_secret')
        ),
        body := '{}'::jsonb
      ) AS request_id;
    $cmd$, v_base || 'ads-bolcom-scheduler?mode=sync')
  );

  perform cron.schedule(
    'ads-bolcom-reports-4x-daily',
    '0 0,6,12,18 * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'internal_webhook_secret')
        ),
        body := '{}'::jsonb
      ) AS request_id;
    $cmd$, v_base || 'ads-bolcom-scheduler?mode=reports')
  );

  perform cron.schedule(
    'ads-ai-engine-daily',
    '0 2 * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'internal_webhook_secret')
        ),
        body := '{}'::jsonb
      ) AS request_id;
    $cmd$, v_base || 'ads-bolcom-scheduler?mode=ai')
  );
end $$;

-- Natrek na het draaien — alle vier moeten x-cron-secret sturen en géén Bearer:
--
--   select jobname, schedule, active,
--          command ~ 'x-cron-secret' as heeft_cron_secret,
--          command ~ 'Bearer'        as heeft_nog_bearer
--   from cron.job
--   where jobname in ('ads-inventory-watch-every-15min','ads-bolcom-sync-every-30min',
--                     'ads-bolcom-reports-4x-daily','ads-ai-engine-daily')
--   order by jobname;
--
-- En binnen een kwartier, om te zien of de 401's weg zijn:
--
--   select status_code, left(coalesce(error_msg, content), 80), created
--   from net._http_response order by id desc limit 10;
