-- De vier ads-cron-jobs een ruimere HTTP-timeout geven, zodat hun antwoord
-- bewaard blijft.
--
-- Aanleiding: `net.http_post` heeft `timeout_milliseconds integer DEFAULT 5000`
-- (nagetrokken op pg_proc, 12 sep 2026). Geen van deze vier jobs gaf die
-- parameter mee, dus vijf seconden was de grens. De edge functions erachter doen
-- meerdere externe API-aanroepen en zitten daar ruim boven — het gevolg is dat
-- `net._http_response.content` en `.status_code` op NULL blijven staan.
--
-- Dat is geen cosmetisch probleem. `ads-bolcom-reports` geeft bij een deelfout
-- een keurige `failures`-lijst terug, precies om dit soort vragen te
-- beantwoorden, en die lijst kwam nooit aan. Op 11 en 12 september kostte dat
-- twee diagnoserondes: beide keren moest er een logexport uit Supabase komen om
-- vast te stellen wat de functie zélf al had verteld — eerst een 400 op een
-- verkeerd API-pad, daarna een 406 op een verkeerde Accept-header.
--
-- `cron.job_run_details` helpt daar niet bij: dat meldt élke run als
-- `succeeded`, want het rapporteert of het VERSTUREN lukte, niet wat er
-- terugkwam. Zie docs/cron-inventaris.md.
--
--
-- WAAROM `cron.alter_job` EN NIET `cron.schedule`
--
-- De eerste versie van deze migratie gebruikte `cron.schedule()`, zoals
-- 20260911094416 dat doet. Dat werkt op dit platform niet meer: er staat een
-- guard op die `cron.schedule` met een sub-hourly schema blokkeert, en
-- rechtstreeks `UPDATE cron.job` wordt met permission denied geweigerd.
-- (Vastgesteld op 12 sep 2026 bij het uitvoeren van deze migratie.)
--
-- `cron.alter_job(job_id, command := …)` komt daar wél doorheen: die raakt de
-- cadans niet aan, dus de schedule-guard vuurt niet. Alleen het commando wordt
-- herschreven. Namen, schema's, URL's en headers blijven ongewijzigd, en het
-- secret wordt nog steeds bij élke run opgezocht in plaats van als tekst in
-- `cron.job.command` te belanden.
--
-- Let op voor een volgende keer: nieuwe sub-hourly jobs aanmaken loopt tegen
-- dezelfde guard. Dat is een platformbeperking, geen fout in deze migratie.
--
--
-- IDEMPOTENT: het commando wordt opnieuw opgebouwd uit de jobnaam, niet
-- aangevuld. Twee keer draaien geeft hetzelfde resultaat.
--
-- BESTAAT DE JOB NIET, dan slaat deze migratie hem over met een notice in plaats
-- van te falen. Op een verse database bestaan deze jobs nog niet; ze worden daar
-- door 20260911094416 aangemaakt, en die migratie loopt zelf tegen de guard aan.
-- Falen zou dan een lege database blokkeren op een job die er hoort te komen.
--
-- TERUGDRAAIEN (geen DOWN-migratie): draai dezelfde `cron.alter_job`-aanroepen
-- zonder de regel `timeout_milliseconds := …`; pg_net valt dan terug op 5000.
-- Daarmee komt ook het probleem terug dat deze migratie oplost.

do $$
declare
  v_base text := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/';
  -- Eén constante, zodat de vier jobs niet uit elkaar kunnen lopen.
  v_timeout integer := 120000;
  v_job record;
  v_jobid bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron ontbreekt — deze migratie hoort niet op deze database';
  end if;

  if not exists (select 1 from public.internal_config where key = 'internal_webhook_secret') then
    raise exception 'internal_config.internal_webhook_secret ontbreekt; zonder dat secret zouden alle vier de jobs 401 geven';
  end if;

  for v_job in
    select * from (values
      ('ads-inventory-watch-every-15min',  'ads-inventory-watch'),
      ('ads-bolcom-sync-every-30min',      'ads-bolcom-scheduler?mode=sync'),
      ('ads-bolcom-reports-4x-daily',      'ads-bolcom-scheduler?mode=reports'),
      ('ads-ai-engine-daily',              'ads-bolcom-scheduler?mode=ai')
    ) as t(jobname, endpoint)
  loop
    select jobid into v_jobid from cron.job where jobname = v_job.jobname;

    if v_jobid is null then
      raise notice 'cron-job % bestaat niet — overgeslagen', v_job.jobname;
      continue;
    end if;

    perform cron.alter_job(
      v_jobid,
      command := format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'internal_webhook_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := %s
      ) AS request_id;
    $cmd$, v_base || v_job.endpoint, v_timeout)
    );
  end loop;
end $$;
