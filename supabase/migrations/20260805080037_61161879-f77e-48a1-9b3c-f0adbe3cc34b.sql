ALTER TABLE public.billing_cycles
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS checkout_session_id text,
  ADD COLUMN IF NOT EXISTS checkout_session_url text,
  ADD COLUMN IF NOT EXISTS checkout_session_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS request_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS billing_cycles_reminder_scan_idx
  ON public.billing_cycles (status, grace_until) WHERE invoice_id IS NULL;