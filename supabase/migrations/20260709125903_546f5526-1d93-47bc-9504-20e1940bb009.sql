
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS last_charge_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dunning_level INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS checkout_session_url TEXT,
  ADD COLUMN IF NOT EXISTS checkout_session_created_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_invoices_dunning_next_action
  ON public.invoices (status, next_action_at)
  WHERE status = 'unpaid';
