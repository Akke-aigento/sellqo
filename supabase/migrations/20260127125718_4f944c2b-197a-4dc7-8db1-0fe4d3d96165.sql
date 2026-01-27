-- Add new webshop SEO fields for Shopify and WooCommerce
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shopify_bullets text[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS woocommerce_bullets text[] DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shopify_meta_title text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shopify_meta_description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS woocommerce_meta_title text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS woocommerce_meta_description text;

-- Add eBay category fields
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ebay_category_name text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ebay_category_path text;

COMMENT ON COLUMN public.products.shopify_bullets IS 'Bullet points for Shopify product listings';
COMMENT ON COLUMN public.products.woocommerce_bullets IS 'Bullet points for WooCommerce product listings';
COMMENT ON COLUMN public.products.shopify_meta_title IS 'SEO meta title for Shopify';
COMMENT ON COLUMN public.products.shopify_meta_description IS 'SEO meta description for Shopify';
COMMENT ON COLUMN public.products.woocommerce_meta_title IS 'SEO meta title for WooCommerce (Yoast/RankMath)';
COMMENT ON COLUMN public.products.woocommerce_meta_description IS 'SEO meta description for WooCommerce (Yoast/RankMath)';
COMMENT ON COLUMN public.products.ebay_category_name IS 'eBay category name (display)';
COMMENT ON COLUMN public.products.ebay_category_path IS 'eBay full category path';