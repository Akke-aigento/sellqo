ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_pricing_model text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_discount_type text CHECK (bundle_discount_type IN ('percentage', 'fixed_amount'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS bundle_discount_value numeric;