-- SUB-UNIFY-2A — sweep op de echte modus — 17 oktober 2026 — GEDRAAID op 17-10-2026 na Akke's go
--
-- De cron subscription-lifecycle-sweep-daily (20261016170000) riep de functie aan met
-- {"dry_run":true}. Na een droge eerste run (17-10 06:50 UTC, response 262240:
-- downgrade 0, excluded 2 = Sandbox + Speeltuin als demo, applied 0) gaat hij op de
-- echte modus: opgezegde winkels na het einde van hun betaalde periode naar Free.
-- Uitsluitingen (demo, intern, billing_exempt, billing_on_hold, billing-tenant) blijven
-- in de functie zelf.
--
-- Idempotent: replace op de body; een tweede run verandert niets meer.
-- Geen secrets: de key komt uit vault (cron_service_role_key).
--
-- Terugdraaien naar droog:
--   select cron.alter_job(j.jobid, command := replace(j.command, '"dry_run":false', '"dry_run":true'))
--     from cron.job j where j.jobname = 'subscription-lifecycle-sweep-daily';

select cron.alter_job(j.jobid, command := replace(j.command, '"dry_run":true', '"dry_run":false'))
  from cron.job j
 where j.jobname = 'subscription-lifecycle-sweep-daily';
