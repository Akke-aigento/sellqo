ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_credit_notes_sent_at ON public.credit_notes(sent_at);