
-- Add linked_product_id to product_variants (links a variant to a standalone product)
ALTER TABLE product_variants ADD COLUMN linked_product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- Add parent_product_id to products (marks a product as a variant of a parent product)
ALTER TABLE products ADD COLUMN parent_product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX idx_products_parent_product_id ON products(parent_product_id) WHERE parent_product_id IS NOT NULL;
CREATE INDEX idx_product_variants_linked_product_id ON product_variants(linked_product_id) WHERE linked_product_id IS NOT NULL;
