-- Add hide_from_storefront column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS hide_from_storefront BOOLEAN DEFAULT false;

-- Add hide_from_storefront column to categories table
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS hide_from_storefront BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.products.hide_from_storefront IS 'When true, product is hidden from webshop but still available in POS';
COMMENT ON COLUMN public.categories.hide_from_storefront IS 'When true, category is hidden from webshop but products can still be sold via POS';