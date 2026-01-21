-- Add Shopify columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS shopify_product_id TEXT,
ADD COLUMN IF NOT EXISTS shopify_variant_id TEXT,
ADD COLUMN IF NOT EXISTS shopify_listing_status TEXT,
ADD COLUMN IF NOT EXISTS shopify_last_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shopify_listing_error TEXT;

-- Add Shopify columns to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS shopify_customer_id TEXT,
ADD COLUMN IF NOT EXISTS shopify_last_synced_at TIMESTAMPTZ;

-- Create index for faster Shopify lookups
CREATE INDEX IF NOT EXISTS idx_products_shopify_product_id ON public.products(shopify_product_id) WHERE shopify_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_shopify_customer_id ON public.customers(shopify_customer_id) WHERE shopify_customer_id IS NOT NULL;