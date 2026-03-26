-- Make marketplace_connection_id nullable for webshop returns
ALTER TABLE public.returns ALTER COLUMN marketplace_connection_id DROP NOT NULL;

-- Make marketplace_return_id nullable for webshop returns
ALTER TABLE public.returns ALTER COLUMN marketplace_return_id DROP NOT NULL;

-- Drop the unique constraint that requires marketplace fields
ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_marketplace_unique;

-- Re-add unique constraint only where marketplace fields are present
CREATE UNIQUE INDEX returns_marketplace_unique ON public.returns (marketplace_connection_id, marketplace_return_id) WHERE marketplace_connection_id IS NOT NULL AND marketplace_return_id IS NOT NULL;

-- Add new columns for refund tracking
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2);
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS refund_status VARCHAR DEFAULT 'none';
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS refund_method VARCHAR;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'marketplace';
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS refund_notes TEXT;