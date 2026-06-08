-- Batch 2C1a-i — Core catalog RLS-aanscherping
-- Scope: products, product_variants, categories, product_categories,
--        product_bundles, product_bundle_items, bundle_products,
--        content_translations
-- Beslispunten bevestigd: warehouse mag products/variants UPDATEN (stock),
--   marketing mag categories + content_translations beheren, cost_price-lek
--   geaccepteerd tot 2C1d.

-- ============================================================
-- products: UPDATE-policy uitbreiden met warehouse
-- ============================================================
DROP POLICY IF EXISTS "Users can update their tenant's products" ON public.products;
CREATE POLICY "Users can update their tenant's products"
ON public.products FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
);

-- ============================================================
-- product_variants: vervang ALL-policy door split INSERT/UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "Tenant staff can manage product_variants" ON public.product_variants;

CREATE POLICY "Tenant staff can insert product_variants"
ON public.product_variants FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
);

CREATE POLICY "Tenant staff can update product_variants"
ON public.product_variants FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin','staff','warehouse']::app_role[])
  )
);

CREATE POLICY "Tenant admins can delete product_variants"
ON public.product_variants FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin']::app_role[])
  )
);

-- ============================================================
-- categories: marketing toevoegen aan INSERT/UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "Users can insert categories for their tenant" ON public.categories;
DROP POLICY IF EXISTS "Users can update their tenant's categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete their tenant's categories" ON public.categories;

CREATE POLICY "Users can insert categories for their tenant"
ON public.categories FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Users can update their tenant's categories"
ON public.categories FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Users can delete their tenant's categories"
ON public.categories FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

-- ============================================================
-- product_categories (junction): rol-aware schrijven
-- ============================================================
DROP POLICY IF EXISTS "Tenant users can manage product categories" ON public.product_categories;

CREATE POLICY "Tenant staff/marketing can insert product_categories"
ON public.product_categories FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_categories.product_id
      AND public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Tenant staff/marketing can update product_categories"
ON public.product_categories FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_categories.product_id
      AND public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_categories.product_id
      AND public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

CREATE POLICY "Tenant staff/marketing can delete product_categories"
ON public.product_categories FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_categories.product_id
      AND public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
  )
);

-- Tenant-scope SELECT voor alle rollen (eerder zat dit in de ALL-policy)
CREATE POLICY "Tenant users can view product_categories"
ON public.product_categories FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_categories.product_id
      AND p.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  )
);

-- ============================================================
-- product_bundles: rol-aware schrijven
-- ============================================================
DROP POLICY IF EXISTS "Users can insert bundles for their tenant" ON public.product_bundles;
DROP POLICY IF EXISTS "Users can update bundles for their tenant" ON public.product_bundles;
DROP POLICY IF EXISTS "Users can delete bundles for their tenant" ON public.product_bundles;

CREATE POLICY "Staff can insert bundles for their tenant"
ON public.product_bundles FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
);

CREATE POLICY "Staff can update bundles for their tenant"
ON public.product_bundles FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
);

CREATE POLICY "Tenant admins can delete bundles"
ON public.product_bundles FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[])
);

-- ============================================================
-- product_bundle_items: rol-aware via parent product
-- ============================================================
DROP POLICY IF EXISTS "Users can insert product bundle items" ON public.product_bundle_items;
DROP POLICY IF EXISTS "Users can update product bundle items" ON public.product_bundle_items;
DROP POLICY IF EXISTS "Users can delete product bundle items" ON public.product_bundle_items;

CREATE POLICY "Staff can insert product bundle items"
ON public.product_bundle_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_bundle_items.product_id
      AND public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
);

CREATE POLICY "Staff can update product bundle items"
ON public.product_bundle_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_bundle_items.product_id
      AND public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_bundle_items.product_id
      AND public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
);

CREATE POLICY "Tenant admins can delete product bundle items"
ON public.product_bundle_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_bundle_items.product_id
      AND public.has_tenant_role(p.tenant_id, ARRAY['tenant_admin']::app_role[])
  )
);

-- ============================================================
-- bundle_products (legacy, behandeld als actief): rol-aware via parent bundle
-- ============================================================
DROP POLICY IF EXISTS "Users can insert bundle products" ON public.bundle_products;
DROP POLICY IF EXISTS "Users can update bundle products" ON public.bundle_products;
DROP POLICY IF EXISTS "Users can delete bundle products" ON public.bundle_products;

CREATE POLICY "Staff can insert bundle_products"
ON public.bundle_products FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.product_bundles b
    WHERE b.id = bundle_products.bundle_id
      AND public.has_tenant_role(b.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
);

CREATE POLICY "Staff can update bundle_products"
ON public.bundle_products FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_bundles b
    WHERE b.id = bundle_products.bundle_id
      AND public.has_tenant_role(b.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.product_bundles b
    WHERE b.id = bundle_products.bundle_id
      AND public.has_tenant_role(b.tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
);

CREATE POLICY "Tenant admins can delete bundle_products"
ON public.bundle_products FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_bundles b
    WHERE b.id = bundle_products.bundle_id
      AND public.has_tenant_role(b.tenant_id, ARRAY['tenant_admin']::app_role[])
  )
);

-- ============================================================
-- content_translations: rol-aware schrijven
-- ============================================================
DROP POLICY IF EXISTS "Users can manage translations for their tenant" ON public.content_translations;

CREATE POLICY "Staff/marketing can insert content_translations"
ON public.content_translations FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Staff/marketing can update content_translations"
ON public.content_translations FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Staff/marketing can delete content_translations"
ON public.content_translations FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);