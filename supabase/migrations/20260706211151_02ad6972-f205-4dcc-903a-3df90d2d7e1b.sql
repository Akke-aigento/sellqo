
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS preferred_language TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_preferred_language_check') THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_preferred_language_check
      CHECK (preferred_language IS NULL OR preferred_language IN ('nl','en','fr','de'));
  END IF;
END $$;

ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS preset_key TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_campaigns_language_check') THEN
    ALTER TABLE public.email_campaigns
      ADD CONSTRAINT email_campaigns_language_check
      CHECK (language IS NULL OR language IN ('nl','en','fr','de'));
  END IF;
END $$;

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'nl';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_language_check') THEN
    ALTER TABLE public.email_templates
      ADD CONSTRAINT email_templates_language_check
      CHECK (language IN ('nl','en','fr','de'));
  END IF;
END $$;
