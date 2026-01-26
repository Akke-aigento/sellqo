-- Add SSL tracking columns to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS ssl_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS ssl_checked_at timestamptz,
ADD COLUMN IF NOT EXISTS ssl_expires_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN public.tenants.ssl_status IS 'SSL certificate status: pending, active, error';
COMMENT ON COLUMN public.tenants.ssl_checked_at IS 'Last time SSL status was checked';
COMMENT ON COLUMN public.tenants.ssl_expires_at IS 'SSL certificate expiration date';