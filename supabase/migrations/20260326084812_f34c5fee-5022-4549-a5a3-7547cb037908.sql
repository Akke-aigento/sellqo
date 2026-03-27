
ALTER TABLE public.storefront_customers 
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE public.storefront_customers 
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;
