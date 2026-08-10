ALTER TABLE public.storefront_carts
  ADD COLUMN IF NOT EXISTS is_b2b boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_company_name text,
  ADD COLUMN IF NOT EXISTS customer_vat_number text,
  ADD COLUMN IF NOT EXISTS customer_vat_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_vat_country text,
  ADD COLUMN IF NOT EXISTS customer_vat_company_name text;