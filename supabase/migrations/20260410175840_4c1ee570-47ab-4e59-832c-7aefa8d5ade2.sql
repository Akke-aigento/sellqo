
-- Add new array column
ALTER TABLE storefront_carts 
  ADD COLUMN discount_codes text[] DEFAULT '{}';

-- Migrate existing data
UPDATE storefront_carts 
  SET discount_codes = ARRAY[discount_code] 
  WHERE discount_code IS NOT NULL AND discount_code != '';

-- Drop old column
ALTER TABLE storefront_carts 
  DROP COLUMN discount_code;
