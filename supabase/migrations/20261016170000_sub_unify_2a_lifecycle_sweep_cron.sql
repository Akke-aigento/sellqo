-- SUB-UNIFY-2A — cron voor subscription-lifecycle-sweep — 16 oktober 2026
-- NOG NIET GEDRAAID. Pas draaien na de deploy van de functie en Akke's go
-- (zie docs/prepared/SUB-UNIFY-2A-deploy.md, stap 4).
--
-- Deze registratie DOET STANDAARD NIETS ECHT: de body is {"dry_run": true}. De functie
-- rapporteert dan alleen (antwoord in net._http_response) en schrijft niets. Bovendien
-- is de functie zelf standaard dry-run: alleen {"dry_run": false} schrijft.
--
-- Dagelijks 06:50 UTC: na check-expired-trials (06:45), vóór process-invoice-dunning
-- (07:00) en sync-billing-state. Zelfde vault-patroon en ruime timeout als de andere
-- billing-crons (engineering-rules R6: net.http_post heeft standaard 5 s).
--
-- Idempotent: cron.schedule met dezelfde jobname vervangt de bestaande job.
--
-- Omschakelen naar de echte modus (APARTE go van Akke, na minstens één goedgekeurde
-- dry-run): dezelfde cron.schedule opnieuw met body '{"source":"cron","dry_run":false}'.
--
-- Terugdraaien: select cron.unschedule('subscription-lifecycle-sweep-daily');

select cron.schedule(
  'subscription-lifecycle-sweep-daily',
  '50 6 * * *',
  $cmd$
      SELECT net.http_post(
        url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/subscription-lifecycle-sweep',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Lovable-Context', 'cron',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key'
          )
        ),
        body := '{"source":"cron","dry_run":true}'::jsonb,
        timeout_milliseconds := 120000
      ) AS request_id;
  $cmd$
);
