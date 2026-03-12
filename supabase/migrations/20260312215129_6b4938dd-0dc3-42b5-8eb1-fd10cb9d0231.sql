-- Drop existing policies
DROP POLICY IF EXISTS "Public read for active products" ON product_categories;
DROP POLICY IF EXISTS "Tenant users can manage product categories" ON product_categories;

-- SELECT: public for active products
CREATE POLICY "Public read for active products" ON product_categories
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_categories.product_id AND p.is_active = true
  )
);

-- SELECT: platform admins can see all
CREATE POLICY "Platform admins can view all product categories" ON product_categories
FOR SELECT USING (public.is_platform_admin(auth.uid()));

-- ALL: tenant users via user_roles
CREATE POLICY "Tenant users can manage product categories" ON product_categories
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM products p
    JOIN user_roles ur ON ur.tenant_id = p.tenant_id
    WHERE p.id = product_categories.product_id AND ur.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM products p
    JOIN user_roles ur ON ur.tenant_id = p.tenant_id
    WHERE p.id = product_categories.product_id AND ur.user_id = auth.uid()
  )
);

-- ALL: platform admins can manage all
CREATE POLICY "Platform admins can manage product categories" ON product_categories
FOR ALL USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));