-- eBay listing fields for products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_listing_status TEXT DEFAULT 'not_listed';
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_offer_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_item_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_optimized_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_optimized_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_last_synced_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_listing_error TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_category_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ebay_condition TEXT DEFAULT 'NEW';

-- Index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_products_ebay_listing_status ON products(ebay_listing_status);