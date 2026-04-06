ALTER TABLE tenant_newsletter_config 
  ADD COLUMN IF NOT EXISTS welcome_email_subject text DEFAULT 'Welkom bij onze nieuwsbrief!',
  ADD COLUMN IF NOT EXISTS welcome_email_body text DEFAULT '';