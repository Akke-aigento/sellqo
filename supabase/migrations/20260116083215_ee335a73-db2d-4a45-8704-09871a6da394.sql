-- Add language column to tenants table
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'nl';

-- Add comment for documentation
COMMENT ON COLUMN public.tenants.language IS 'Preferred language for the tenant (nl, en, de, fr)';