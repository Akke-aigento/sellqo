-- EVENT-REMINDER-2 — inhaalmail voor wie na de dag-van-herinnering een ticket koopt.
-- Per ticket bijhouden of de herinnering vertrokken is, en de cron elke 10 minuten
-- laten lopen in plaats van één keer om 08:00 UTC. Idempotent.
--
-- Terugdraaien (handmatig):
--   select cron.alter_job(390, schedule := '0 8 * * *');
--   alter table public.ticket_instances drop column if exists reminder_sent_at;
--   en send-event-reminder terugzetten naar EVENT-REMINDER-1.

ALTER TABLE public.ticket_instances
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

COMMENT ON COLUMN public.ticket_instances.reminder_sent_at IS
  'When the day-of reminder email (WhatsApp group link) went out for this ticket; NULL = not yet';

-- Backfill: tickets die al in een verstuurde batch zaten, gelden als verstuurd.
-- (EVENT-REMINDER-1 stuurde per event alle tickets die op dat moment geldig waren.)
UPDATE public.ticket_instances ti
SET reminder_sent_at = ed.reminder_sent_at
FROM public.event_details ed
WHERE ti.event_detail_id = ed.id
  AND ed.reminder_sent_at IS NOT NULL
  AND ti.reminder_sent_at IS NULL
  AND ti.created_at <= ed.reminder_sent_at
  AND ti.status IN ('valid', 'checked_in');

-- Cron: elke 10 minuten van 08:00 tot 22:50 UTC (10:00–00:50 Brussel in de zomer).
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'send-event-reminders-daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(v_jobid, schedule := '*/10 8-22 * * *');
  END IF;
END $$;
