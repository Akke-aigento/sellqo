ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS label_last_status TEXT,
  ADD COLUMN IF NOT EXISTS label_last_event_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS label_tracking_events JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_returns_label_tracking_number
  ON public.returns (tenant_id, label_tracking_number)
  WHERE label_tracking_number IS NOT NULL;