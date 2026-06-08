-- Batch 2C1a-iii — External reviews RLS-aanscherping
-- Scope: external_reviews

DROP POLICY IF EXISTS "Users can view their tenant's external reviews" ON public.external_reviews;
DROP POLICY IF EXISTS "Users can insert their tenant's external reviews" ON public.external_reviews;
DROP POLICY IF EXISTS "Users can update their tenant's external reviews" ON public.external_reviews;
DROP POLICY IF EXISTS "Users can delete their tenant's external reviews" ON public.external_reviews;

-- Public-read (visible=true) policy "Public can view visible reviews" wordt NIET aangeraakt.

CREATE POLICY "Tenant users can view external_reviews"
ON public.external_reviews FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing','viewer']::app_role[])
);

CREATE POLICY "Moderators can insert external_reviews"
ON public.external_reviews FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Moderators can update external_reviews"
ON public.external_reviews FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
)
WITH CHECK (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);

CREATE POLICY "Moderators can delete external_reviews"
ON public.external_reviews FOR DELETE TO authenticated
USING (
  tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[])
);