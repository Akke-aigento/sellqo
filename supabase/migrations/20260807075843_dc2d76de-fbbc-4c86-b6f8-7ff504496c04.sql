ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS platform_newsletter_opt_in boolean NOT NULL DEFAULT true;