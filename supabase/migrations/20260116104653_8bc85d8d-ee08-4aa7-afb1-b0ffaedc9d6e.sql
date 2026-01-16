-- Add B2B customer fields to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'b2c' CHECK (customer_type IN ('b2c', 'b2b')),
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS vat_number TEXT,
ADD COLUMN IF NOT EXISTS vat_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vat_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tax_exempt_reason TEXT CHECK (tax_exempt_reason IN ('reverse_charge', 'export', 'exempt', NULL)),
ADD COLUMN IF NOT EXISTS billing_street TEXT,
ADD COLUMN IF NOT EXISTS billing_city TEXT,
ADD COLUMN IF NOT EXISTS billing_postal_code TEXT,
ADD COLUMN IF NOT EXISTS billing_country TEXT DEFAULT 'NL',
ADD COLUMN IF NOT EXISTS billing_address_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shipping_street TEXT,
ADD COLUMN IF NOT EXISTS shipping_city TEXT,
ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT,
ADD COLUMN IF NOT EXISTS shipping_country TEXT,
ADD COLUMN IF NOT EXISTS shipping_address_verified BOOLEAN DEFAULT false;

-- Add VAT settings to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS default_vat_handling TEXT DEFAULT 'inclusive' CHECK (default_vat_handling IN ('inclusive', 'exclusive')),
ADD COLUMN IF NOT EXISTS apply_oss_rules BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reverse_charge_text TEXT DEFAULT 'BTW verlegd naar afnemer conform artikel 44 EU BTW-richtlijn',
ADD COLUMN IF NOT EXISTS export_text TEXT DEFAULT 'Vrijgesteld van BTW - levering buiten EU';

-- Create index for VAT number lookups
CREATE INDEX IF NOT EXISTS idx_customers_vat_number ON public.customers(vat_number) WHERE vat_number IS NOT NULL;

-- Create index for customer type
CREATE INDEX IF NOT EXISTS idx_customers_type ON public.customers(customer_type);