-- Add bundle-specific columns to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS bundle_pricing_model text,
  ADD COLUMN IF NOT EXISTS bundle_discount_type text,
  ADD COLUMN IF NOT EXISTS bundle_discount_value numeric;

-- Add check constraints
ALTER TABLE products
  ADD CONSTRAINT products_bundle_pricing_model_check
    CHECK (bundle_pricing_model IS NULL OR bundle_pricing_model IN ('fixed', 'dynamic'));

ALTER TABLE products
  ADD CONSTRAINT products_bundle_discount_type_check
    CHECK (bundle_discount_type IS NULL OR bundle_discount_type IN ('percentage', 'fixed_amount'));

-- Create product_bundle_items table
CREATE TABLE product_bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  child_product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  customer_can_adjust boolean NOT NULL DEFAULT false,
  min_quantity integer,
  max_quantity integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_bundle_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT product_bundle_items_min_positive CHECK (min_quantity IS NULL OR min_quantity > 0),
  CONSTRAINT product_bundle_items_max_gte_min CHECK (max_quantity IS NULL OR min_quantity IS NULL OR max_quantity >= min_quantity),
  CONSTRAINT product_bundle_items_no_self_reference CHECK (product_id <> child_product_id)
);

-- Index for fast lookups
CREATE INDEX idx_product_bundle_items_product_id ON product_bundle_items(product_id);
CREATE INDEX idx_product_bundle_items_child_product_id ON product_bundle_items(child_product_id);

-- Enable RLS
ALTER TABLE product_bundle_items ENABLE ROW LEVEL SECURITY;

-- RLS policies: match existing project pattern using get_user_tenant_ids + role checks
-- Select: any authenticated user in the tenant, or public access via parent product
CREATE POLICY "Users can view bundle items via product tenant"
  ON product_bundle_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_bundle_items.product_id
        AND p.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    )
  );

CREATE POLICY "Public can view active bundle items"
  ON product_bundle_items FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_bundle_items.product_id
        AND p.is_active = true
    )
  );

CREATE POLICY "Staff can insert bundle items"
  ON product_bundle_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_bundle_items.product_id
        AND p.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    )
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Staff can update bundle items"
  ON product_bundle_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_bundle_items.product_id
        AND p.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    )
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'staff'))
  );

CREATE POLICY "Staff can delete bundle items"
  ON product_bundle_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_bundle_items.product_id
        AND p.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    )
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'staff'))
  );
