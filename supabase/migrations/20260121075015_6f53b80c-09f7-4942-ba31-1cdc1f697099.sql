-- Add Shopify optimized content columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS shopify_optimized_title TEXT,
ADD COLUMN IF NOT EXISTS shopify_optimized_description TEXT;