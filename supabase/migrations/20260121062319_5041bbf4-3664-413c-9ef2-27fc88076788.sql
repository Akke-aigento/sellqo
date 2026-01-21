-- Add marketplace listing fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS bol_listing_status TEXT DEFAULT 'not_listed';
ALTER TABLE products ADD COLUMN IF NOT EXISTS bol_offer_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bol_optimized_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bol_optimized_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bol_bullets TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS bol_delivery_code TEXT DEFAULT '24uurs-21';
ALTER TABLE products ADD COLUMN IF NOT EXISTS bol_condition TEXT DEFAULT 'NEW';
ALTER TABLE products ADD COLUMN IF NOT EXISTS bol_fulfilment_method TEXT DEFAULT 'FBR';
ALTER TABLE products ADD COLUMN IF NOT EXISTS bol_last_synced_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bol_listing_error TEXT;

-- Amazon fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_listing_status TEXT DEFAULT 'not_listed';
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_offer_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_optimized_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_optimized_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_bullets TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_last_synced_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS amazon_listing_error TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_bol_listing_status ON products(bol_listing_status);
CREATE INDEX IF NOT EXISTS idx_products_amazon_listing_status ON products(amazon_listing_status);