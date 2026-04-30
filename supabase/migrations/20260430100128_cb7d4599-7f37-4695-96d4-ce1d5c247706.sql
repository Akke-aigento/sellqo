BEGIN;

-- ============================================================
-- FIX 1: order_items — remove public anon access
-- ============================================================
DROP POLICY IF EXISTS "Public can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Anon can view order items for recent orders" ON public.order_items;

CREATE POLICY "Anon can view order items for recent orders"
ON public.order_items
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.created_at > now() - interval '24 hours'
  )
);

-- ============================================================
-- FIX 2: orders — narrow 30-day window to 24 hours
-- ============================================================
DROP POLICY IF EXISTS "Anon can view recent orders by id" ON public.orders;
DROP POLICY IF EXISTS "Public can view orders by id" ON public.orders;

CREATE POLICY "Anon can view recent orders by id"
ON public.orders
FOR SELECT
TO anon
USING (created_at > now() - interval '24 hours');

-- ============================================================
-- FIX 3: product_variants — fix {public} role to proper scoping
-- ============================================================
DROP POLICY IF EXISTS "Service role full access on product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Platform admins can manage product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Users can view their tenant product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Tenant staff can manage product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Public can view active product_variants" ON public.product_variants;

CREATE POLICY "Service role full access on product_variants"
ON public.product_variants
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Platform admins can manage product_variants"
ON public.product_variants
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view their tenant product_variants"
ON public.product_variants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND p.tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Tenant staff can manage product_variants"
ON public.product_variants
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND p.tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  )
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND p.tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  )
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Public can view active product_variants"
ON public.product_variants
FOR SELECT
TO anon
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND p.is_active = true
      AND p.hide_from_storefront = false
  )
);

-- ============================================================
-- FIX 4: storefront_carts — fix {public} role, PII exposed
-- ============================================================
DROP POLICY IF EXISTS "Service role full access on storefront_carts" ON public.storefront_carts;
DROP POLICY IF EXISTS "Platform admins can view storefront_carts" ON public.storefront_carts;
DROP POLICY IF EXISTS "Tenant users can view their carts" ON public.storefront_carts;

CREATE POLICY "Service role full access on storefront_carts"
ON public.storefront_carts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Platform admins can view storefront_carts"
ON public.storefront_carts
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant users can view their carts"
ON public.storefront_carts
FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
);

-- ============================================================
-- FIX 4b: storefront_cart_items — same {public} role issue
-- ============================================================
DROP POLICY IF EXISTS "Service role full access on storefront_cart_items" ON public.storefront_cart_items;
DROP POLICY IF EXISTS "Platform admins can view storefront_cart_items" ON public.storefront_cart_items;
DROP POLICY IF EXISTS "Tenant users can view their cart_items" ON public.storefront_cart_items;

CREATE POLICY "Service role full access on storefront_cart_items"
ON public.storefront_cart_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Platform admins can view storefront_cart_items"
ON public.storefront_cart_items
FOR SELECT
TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant users can view their cart_items"
ON public.storefront_cart_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.storefront_carts c
    WHERE c.id = storefront_cart_items.cart_id
      AND c.tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  )
);

COMMIT;