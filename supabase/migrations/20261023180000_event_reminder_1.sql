-- EVENT-REMINDER-1 — dag-van herinneringsmail met WhatsApp-groeplink.
-- Al live gedraaid via query_database op 23-10-2026 (nagetrokken in
-- information_schema.columns); dit bestand houdt repo en DB gelijk. Idempotent.
-- Terugdraaien (handmatig): alter table public.event_details drop column if exists whatsapp_url, drop column if exists reminder_sent_at;
ALTER TABLE public.event_details
  ADD COLUMN IF NOT EXISTS whatsapp_url text,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

COMMENT ON COLUMN public.event_details.whatsapp_url IS 'WhatsApp group invite link shown in day-of reminder email';
COMMENT ON COLUMN public.event_details.reminder_sent_at IS 'Timestamp when the day-of reminder email batch was sent; NULL = not yet sent';
