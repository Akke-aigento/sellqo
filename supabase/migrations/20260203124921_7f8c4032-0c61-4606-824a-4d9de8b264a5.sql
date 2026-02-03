-- CUSTOMERS: Extra velden voor Shopify import
ALTER TABLE customers ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS province_code TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE customers ADD COLUMN IF NOT EXISTS verified_email BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_marketing_status TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_marketing_level TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_marketing_status TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_marketing_level TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS original_created_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS import_source TEXT;

-- PRODUCTS: Extra velden voor Shopify import
ALTER TABLE products ADD COLUMN IF NOT EXISTS shopify_handle TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS google_product_category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_alt_texts TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS shopify_product_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS published_scope TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS original_created_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS import_source TEXT;

-- ORDERS: Extra velden voor Shopify import
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_tags TEXT[];
ALTER TABLE orders ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_created_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS import_source TEXT;

-- ORDER_ITEMS: Extra velden voor vendor per item
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_title TEXT;