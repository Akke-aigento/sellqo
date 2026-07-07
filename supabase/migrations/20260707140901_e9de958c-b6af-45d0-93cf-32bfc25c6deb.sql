ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS available_languages text[] NOT NULL DEFAULT ARRAY['nl']::text[];