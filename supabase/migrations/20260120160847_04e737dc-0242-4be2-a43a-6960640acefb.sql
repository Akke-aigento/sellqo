-- Phase 6: Extend orders table with VAT-specific columns for proper tax tracking

-- Add VAT tracking columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vat_type TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vat_country TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vat_text TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_vat_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_vat_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_company_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'b2c';

-- Add index for VAT reporting queries
CREATE INDEX IF NOT EXISTS idx_orders_vat_type ON public.orders(vat_type);
CREATE INDEX IF NOT EXISTS idx_orders_vat_country ON public.orders(vat_country);
CREATE INDEX IF NOT EXISTS idx_orders_customer_type ON public.orders(customer_type);

-- Add comment for documentation
COMMENT ON COLUMN public.orders.vat_type IS 'VAT regime: standard, reverse_charge, export, oss, exempt';
COMMENT ON COLUMN public.orders.vat_rate IS 'Applied VAT percentage';
COMMENT ON COLUMN public.orders.vat_country IS 'Country used for VAT determination';
COMMENT ON COLUMN public.orders.vat_text IS 'Legal text for invoice (e.g., reverse charge mention)';
COMMENT ON COLUMN public.orders.customer_vat_number IS 'Customer VAT number for B2B orders';
COMMENT ON COLUMN public.orders.customer_vat_verified IS 'Whether VAT number was verified via VIES';
COMMENT ON COLUMN public.orders.customer_company_name IS 'Company name for B2B orders';
COMMENT ON COLUMN public.orders.customer_type IS 'Customer type: b2b or b2c';