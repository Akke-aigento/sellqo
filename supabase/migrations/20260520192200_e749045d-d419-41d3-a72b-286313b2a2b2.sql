ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_invoices_metadata_gin
  ON public.invoices USING gin (metadata jsonb_path_ops);