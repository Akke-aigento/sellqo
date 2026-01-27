-- Add is_demo column to tenants table for demo stores
-- Demo stores have unlimited functionality and are excluded from platform statistics
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.tenants.is_demo IS 'Demo stores have unlimited functionality and are excluded from platform statistics';