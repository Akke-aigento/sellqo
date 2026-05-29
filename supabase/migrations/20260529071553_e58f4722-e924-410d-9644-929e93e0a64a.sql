-- =========================================================================
-- Batch 1C: Catalog tables lockdown
-- product_bundle_items + product_variant_options
-- =========================================================================

-- -------------------------------------------------------------------------
-- product_bundle_items
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view bundle items" ON public.product_bundle_items;
DROP POLICY IF EXISTS "Public can view bundle items" ON public.product_bundle_items;
DROP POLICY IF EXISTS "Bundle items are viewable by everyone" ON public.product_bundle_items;

CREATE POLICY "Anon can view bundle items of active products"
ON public.product_bundle_items
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_bundle_items.product_id
      AND p.is_active = true
      AND p.hide_from_storefront = false
  )
);

-- -------------------------------------------------------------------------
-- product_variant_options — drop misconfigured public ALL policy
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role full access on product_variant_options"
  ON public.product_variant_options;
DROP POLICY IF EXISTS "Enable all access for service role"
  ON public.product_variant_options;

-- Anon SELECT bounded on active+visible parent product
CREATE POLICY "Anon can view variant options of active products"
ON public.product_variant_options
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variant_options.product_id
      AND p.is_active = true
      AND p.hide_from_storefront = false
  )
);

-- Authenticated SELECT tenant-scoped
CREATE POLICY "Authenticated can view variant options of their tenant"
ON public.product_variant_options
FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
);

-- Manage: tenant_admin + staff of the same tenant
CREATE POLICY "Tenant staff can manage variant options"
ON public.product_variant_options
FOR ALL
TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (
    public.has_role(auth.uid(), 'tenant_admin')
    OR public.has_role(auth.uid(), 'staff')
    OR public.is_platform_admin(auth.uid())
  )
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND (
    public.has_role(auth.uid(), 'tenant_admin')
    OR public.has_role(auth.uid(), 'staff')
    OR public.is_platform_admin(auth.uid())
  )
);

-- service_role bypasses RLS automatically — no explicit policy needed.
