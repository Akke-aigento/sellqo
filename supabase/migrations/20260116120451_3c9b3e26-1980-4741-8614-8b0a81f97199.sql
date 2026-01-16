-- Add Peppol ID to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS peppol_id text;

-- Add Peppol ID to customers table for B2B customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS peppol_id text;

-- Add Peppol tracking fields to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS peppol_status text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS peppol_sent_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_b2b boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.tenants.peppol_id IS 'Peppol endpoint ID for e-invoicing (format: scheme:identifier, e.g., 0208:0123456789)';
COMMENT ON COLUMN public.customers.peppol_id IS 'Peppol endpoint ID for receiving e-invoices (format: scheme:identifier)';
COMMENT ON COLUMN public.invoices.peppol_status IS 'Peppol sending status: pending, sent, delivered, failed';
COMMENT ON COLUMN public.invoices.peppol_sent_at IS 'Timestamp when invoice was sent via Peppol network';
COMMENT ON COLUMN public.invoices.is_b2b IS 'Whether this is a B2B invoice (for Peppol requirement tracking)';