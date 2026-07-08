
ALTER TABLE public.mandate_setup_tokens
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;
