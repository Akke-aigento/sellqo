-- CREDITS-202610 — realtime-publicatie en */5-crons afslanken.
--
-- Aanleiding (Watchtower-meting oktober 2026): realtime-WAL-polling is ~39% van
-- de DB-tijd van SellQo. Supabase Realtime leest de WAL voor élke tabel in de
-- publicatie `supabase_realtime`, ook als geen enkel scherm erop luistert.
--
-- 1. REALTIME
--
-- Recon (ripgrep op `postgres_changes` in src/ en supabase/functions, 12 okt 2026):
-- schermen luisteren live op customer_messages, customers, notifications, orders,
-- team_invitations en ticket_scans. Op de drie tabellen hieronder luistert
-- NIETS — het zijn interne logtabellen (automation_runs, sync_activity_log) en
-- external_reviews, die enkel met gewone selects gelezen worden
-- (useSyncHistory, MarketplaceDetail, useReviewsHub).
-- Custom frontends gebruiken realtime niet op deze tabellen: ze praten via
-- storefront-api / storefront-customer-api, en geen van de drie is een
-- gedeelde storefront-tabel (CLAUDE.md §1).
--
-- 2. CRONS
--
-- auto-invoice-cron: */5 → '*/15 6-23 * * *' (UTC). De functie pakt betaalde
--   orders van de laatste 30 dagen zonder factuur op; een nachtelijke order krijgt
--   zijn factuur dus bij de eerste run na 06:00 UTC. Niets gaat verloren.
-- update-bol-tracking-every-5min: */5 → '*/15 * * * *' (UTC), bewust OOK 's nachts.
--   Deze functie meldt de verzending (track & trace) aan bol.com. Bol rekent de
--   verzendbevestiging tegen de beloofde leverdatum; een zending die 's avonds
--   laat geregistreerd wordt, mag niet tot de ochtend blijven liggen. Daarom geen
--   nachtpauze, wel 15 i.p.v. 5 minuten. De jobnaam blijft (geen hernoeming).
-- marketplace-sync-scheduler: ONGEMOEID — eerst bespreken met Akke.
--
-- Let op: 20260912140000 meldt een platform-guard die `cron.schedule` met een
-- sub-hourly schema blokkeert. `cron.alter_job(..., schedule := ...)` met een
-- */15-schema is hier niet eerder geprobeerd. Faalt deze migratie op die guard,
-- draai dan enkel deel 1 en stel de cadans in via query_database (0 credits).
--
-- IDEMPOTENT: tabellen worden enkel verwijderd als ze in de publicatie zitten;
-- jobs worden op naam opgezocht en twee keer hetzelfde schema zetten is een no-op.
--
-- DOWN (handmatig):
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_runs,
--     public.sync_activity_log, public.external_reviews;
--   select cron.alter_job(jobid, schedule := '*/5 * * * *') from cron.job
--     where jobname in ('auto-invoice-cron', 'update-bol-tracking-every-5min');

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['automation_runs', 'sync_activity_log', 'external_reviews'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

SELECT cron.alter_job(jobid, schedule := '*/15 6-23 * * *')
FROM cron.job WHERE jobname = 'auto-invoice-cron';

SELECT cron.alter_job(jobid, schedule := '*/15 * * * *')
FROM cron.job WHERE jobname = 'update-bol-tracking-every-5min';
