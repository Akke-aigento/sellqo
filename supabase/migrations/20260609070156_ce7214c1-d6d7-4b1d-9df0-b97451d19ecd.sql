
-- ============================================================
-- LEK 2: vat_validations — consolidate INSERT with explicit role guard
-- ============================================================
DROP POLICY IF EXISTS "Platform admins can insert vat validations" ON public.vat_validations;
DROP POLICY IF EXISTS "Users can insert vat validations for their tenant" ON public.vat_validations;

CREATE POLICY "vat_validations_insert"
  ON public.vat_validations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','accountant']::public.app_role[])
    )
  );

-- ============================================================
-- LEK 3a: vat_returns — split ALL into per-cmd, role-aware
-- ============================================================
DROP POLICY IF EXISTS "Tenant users can manage VAT returns" ON public.vat_returns;

CREATE POLICY "vat_returns_select"
  ON public.vat_returns FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY "vat_returns_insert"
  ON public.vat_returns FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','accountant']::public.app_role[])
    )
  );

CREATE POLICY "vat_returns_update"
  ON public.vat_returns FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','accountant']::public.app_role[])
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','accountant']::public.app_role[])
    )
  );

CREATE POLICY "vat_returns_delete"
  ON public.vat_returns FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','accountant']::public.app_role[])
    )
  );

-- ============================================================
-- LEK 3b: subscriptions — replace tenant-blind policies with role-aware
-- ============================================================
DROP POLICY IF EXISTS "Tenant users can view subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Tenant users can create subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Tenant users can update subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Tenant users can delete subscriptions" ON public.subscriptions;

CREATE POLICY "subscriptions_select"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY "subscriptions_insert"
  ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[])
    )
  );

CREATE POLICY "subscriptions_update"
  ON public.subscriptions FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[])
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[])
    )
  );

CREATE POLICY "subscriptions_delete"
  ON public.subscriptions FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[])
    )
  );

-- ============================================================
-- LEK 3c: subscription_invoices — read-only for tenants; writes via service-role/platform_admin; mutate = tenant_admin
-- ============================================================
DROP POLICY IF EXISTS "Tenant users can manage subscription invoices" ON public.subscription_invoices;

CREATE POLICY "subscription_invoices_select"
  ON public.subscription_invoices FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR subscription_id IN (
      SELECT id FROM public.subscriptions
      WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
    )
  );

-- No INSERT policy for authenticated → only service_role (and platform_admin via separate policy) can write.
CREATE POLICY "subscription_invoices_insert_admin"
  ON public.subscription_invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "subscription_invoices_update"
  ON public.subscription_invoices FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR subscription_id IN (
      SELECT id FROM public.subscriptions
      WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
        AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[])
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR subscription_id IN (
      SELECT id FROM public.subscriptions
      WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
        AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[])
    )
  );

CREATE POLICY "subscription_invoices_delete"
  ON public.subscription_invoices FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR subscription_id IN (
      SELECT id FROM public.subscriptions
      WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
        AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[])
    )
  );

-- ============================================================
-- LEK 3d: tenant_return_settings — write/delete = tenant_admin
-- ============================================================
DROP POLICY IF EXISTS "Tenant users can manage their return settings" ON public.tenant_return_settings;

CREATE POLICY "tenant_return_settings_select"
  ON public.tenant_return_settings FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY "tenant_return_settings_insert"
  ON public.tenant_return_settings FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[])
    )
  );

CREATE POLICY "tenant_return_settings_update"
  ON public.tenant_return_settings FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[])
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[])
    )
  );

CREATE POLICY "tenant_return_settings_delete"
  ON public.tenant_return_settings FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::public.app_role[])
    )
  );

-- ============================================================
-- LEK 3e: translation_settings — write/delete = tenant_admin/staff/marketing
-- ============================================================
DROP POLICY IF EXISTS "Users can manage translation settings for their tenant" ON public.translation_settings;
DROP POLICY IF EXISTS "Users can view translation settings for their tenant" ON public.translation_settings;

CREATE POLICY "translation_settings_select"
  ON public.translation_settings FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY "translation_settings_insert"
  ON public.translation_settings FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::public.app_role[])
    )
  );

CREATE POLICY "translation_settings_update"
  ON public.translation_settings FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::public.app_role[])
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::public.app_role[])
    )
  );

CREATE POLICY "translation_settings_delete"
  ON public.translation_settings FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
      AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::public.app_role[])
    )
  );
