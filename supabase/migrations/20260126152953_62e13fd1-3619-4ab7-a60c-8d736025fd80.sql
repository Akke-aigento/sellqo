-- Add ogm_reference column for bank transfer structured communication (OGM)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS ogm_reference TEXT;

-- Add index for faster lookup by OGM reference
CREATE INDEX IF NOT EXISTS idx_orders_ogm_reference ON public.orders(ogm_reference) WHERE ogm_reference IS NOT NULL;