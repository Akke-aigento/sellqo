
-- Drop foreign key constraint if it exists
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_gift_card_design_id_fkey;

-- Change column type from uuid to text
ALTER TABLE products ALTER COLUMN gift_card_design_id TYPE text;
