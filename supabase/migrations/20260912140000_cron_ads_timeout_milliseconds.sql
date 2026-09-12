-- De vier ads-cron-jobs een ruimere HTTP-timeout geven, zodat hun antwoord
-- bewaard blijft.
--
-- Aanleiding: `net.http_post` heeft `timeout_milliseconds integer DEFAULT 5000`
-- (nagetrokken op pg_proc, 12 sep 2026). Geen van deze vier jobs geeft die
-- parameter mee, dus vijf seconden is de grens. De edge functions erachter doen
-- meerdere externe API-aanroepen en zijn daar ruim overheen — het gevolg is dat
-- `net._http_response.content` en `.status_code` op NULL blijven staan.
--
-- Dat is geen cosmetisch probleem. `ads-bolcom-reports` geeft bij een
-- deelfout een keurige `failures`-lijst terug, precies om dit soort vragen te
-- beantwoorden, en die lijst kwam nooit aan. Op 11 en 12 september kostte dat
-- twee diagnoserondes: beide keren moest een logexport uit Supabase komen om
-- vast te stellen wat de functie zelf al had verteld — de eerste keer een 400 op
-- een verkeerd API-pad, de tweede een 406 op een verkeerde Accept-header.
--
-- `cron.job_run_details` helpt daar niet bij: dat meldt élke run als
-- `succeeded`, want het rapporteert of het VERSTUREN lukte, niet wat er
-- terugkwam. Een job die vier maanden 401's krijgt ziet er daar identiek uit aan
-- een job die werkt. Zie docs/cron-inventaris.md.
--
-- Waarom 120 seconden: een reports-run doet één aanroep per dag in het gevraagde
-- bereik, tot dertig dagen, plus zoektermen — in de praktijk enkele seconden,
-- maar bij een breed bereik tientallen. Twee minuten zit daar ruim boven en
-- houdt de pg_net-worker toch begrensd; een timeout zonder bovengrens bestaat
-- niet en zou de wachtrij voor de andere jobs kunnen blokkeren.
--
-- Verder verandert er niets: dezelfde jobnamen, schema's, URL's en headers. Het
-- secret wordt nog steeds bij élke run opgezocht in plaats van als tekst in
-- `cron.job.command` te belanden.
--
-- IDEMPOTENT: cron.schedule() met een bestaande jobnaam vervangt die job.
-- Twee keer draaien geeft hetzelfde resultaat.
--
-- TERUGDRAAIEN (geen DOWN-migratie): laat `timeout_milliseconds` weg uit de vier
-- commando's; pg_net valt dan terug op 5000. Daarmee komt ook het probleem
-- terug dat deze migratie oplost.

do $$
declare
  v_base text := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/';
  -- Eén constante, zodat de vier jobs niet uit elkaar kunnen lopen.
  v_timeout integer := 120000;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron ontbreekt — deze migratie hoort niet op deze database';
  end if;

  if not exists (select 1 from public.internal_config where key = 'internal_webhook_secret') then
    raise exception 'internal_config.internal_webhook_secret ontbreekt; zonder dat secret zouden alle vier de jobs 401 geven';
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
        body := '{}'::jsonb,
        timeout_milliseconds := %s
      ) AS request_id;
    $cmd$, v_base || 'ads-inventory-watch', v_timeout)
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
        body := '{}'::jsonb,
        timeout_milliseconds := %s
      ) AS request_id;
    $cmd$, v_base || 'ads-bolcom-scheduler?mode=sync', v_timeout)
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
        body := '{}'::jsonb,
        timeout_milliseconds := %s
      ) AS request_id;
    $cmd$, v_base || 'ads-bolcom-scheduler?mode=reports', v_timeout)
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
        body := '{}'::jsonb,
        timeout_milliseconds := %s
      ) AS request_id;
    $cmd$, v_base || 'ads-bolcom-scheduler?mode=ai', v_timeout)
  );
end $$;
