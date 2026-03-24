
-- Add new fields to storefront_customers
ALTER TABLE public.storefront_customers
  ADD COLUMN IF NOT EXISTS newsletter_opted_in BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS newsletter_opted_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS vat_number TEXT,
  ADD COLUMN IF NOT EXISTS vat_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_verified_at TIMESTAMPTZ;

-- Add storefront_customer_id to customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS storefront_customer_id UUID REFERENCES public.storefront_customers(id);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_customers_storefront_customer_id ON public.customers(storefront_customer_id) WHERE storefront_customer_id IS NOT NULL;
