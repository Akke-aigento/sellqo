
DROP POLICY IF EXISTS tenant_theme_settings_insert_admin ON public.tenant_theme_settings;
DROP POLICY IF EXISTS tenant_theme_settings_update_admin ON public.tenant_theme_settings;
DROP POLICY IF EXISTS tenant_theme_settings_delete_admin ON public.tenant_theme_settings;

CREATE POLICY tenant_theme_settings_insert_admin
  ON public.tenant_theme_settings FOR INSERT TO authenticated
  WITH CHECK (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    OR is_platform_admin(auth.uid())
  );

CREATE POLICY tenant_theme_settings_update_admin
  ON public.tenant_theme_settings FOR UPDATE TO authenticated
  USING (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    OR is_platform_admin(auth.uid())
  )
  WITH CHECK (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    OR is_platform_admin(auth.uid())
  );

CREATE POLICY tenant_theme_settings_delete_admin
  ON public.tenant_theme_settings FOR DELETE TO authenticated
  USING (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    OR is_platform_admin(auth.uid())
  );
