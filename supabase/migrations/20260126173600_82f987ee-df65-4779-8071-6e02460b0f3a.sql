-- Add auto invoice settings to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS auto_generate_invoice BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_send_invoice_email BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.tenants.auto_generate_invoice IS 'Automatically generate invoice when order payment_status becomes paid';
COMMENT ON COLUMN public.tenants.auto_send_invoice_email IS 'Automatically email invoice to customer after generation';