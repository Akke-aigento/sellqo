-- Add VAT flexibility settings to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS enable_b2b_checkout BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS simplified_vat_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS simplified_vat_acknowledged_at TIMESTAMPTZ;