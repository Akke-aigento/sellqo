DROP POLICY IF EXISTS "Tenant members can view API keys" ON public.storefront_api_keys;
DROP POLICY IF EXISTS "Tenant admins can insert API keys" ON public.storefront_api_keys;
DROP POLICY IF EXISTS "Tenant admins can update API keys" ON public.storefront_api_keys;
DROP POLICY IF EXISTS "Tenant admins can delete API keys" ON public.storefront_api_keys;

CREATE POLICY "Tenant members or platform admin can view API keys"
  ON public.storefront_api_keys FOR SELECT
  USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  );

CREATE POLICY "Tenant admins or platform admin can insert API keys"
  ON public.storefront_api_keys FOR INSERT
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('platform_admin','tenant_admin'))
  );

CREATE POLICY "Tenant admins or platform admin can update API keys"
  ON public.storefront_api_keys FOR UPDATE
  USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('platform_admin','tenant_admin'))
  );

CREATE POLICY "Tenant admins or platform admin can delete API keys"
  ON public.storefront_api_keys FOR DELETE
  USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('platform_admin','tenant_admin'))
  );