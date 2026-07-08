ALTER TABLE public.subscription_invoices
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_invoices_sub_period_uniq
  ON public.subscription_invoices (subscription_id, period_start)
  WHERE period_start IS NOT NULL;