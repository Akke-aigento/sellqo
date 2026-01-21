-- Add WooCommerce fields to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS woocommerce_product_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS woocommerce_variant_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS woocommerce_listing_status TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS woocommerce_listing_error TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS woocommerce_last_synced_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS woocommerce_optimized_title TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS woocommerce_optimized_description TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_woocommerce_product_id ON public.products(woocommerce_product_id) WHERE woocommerce_product_id IS NOT NULL;