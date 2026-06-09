
-- ============================================================================
-- Batch 2D-i — Reports cluster RLS-aanscherping
-- Bron: docs/fase2-batch-2d-recon.md + bevestigde beslispunten OB1, OB5.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- vat_returns — tighten SELECT (was tenant-blind read for any role).
-- INSERT/UPDATE/DELETE already correct via pre-2D-quickfix.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS vat_returns_select ON public.vat_returns;

CREATE POLICY vat_returns_select ON public.vat_returns
  FOR SELECT TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'accountant'::app_role])
    )
  );

-- ----------------------------------------------------------------------------
-- vat_validations — tighten SELECT + add UPDATE/DELETE for admin+accountant.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Platform admins can view all vat validations" ON public.vat_validations;
DROP POLICY IF EXISTS "Users can view their tenant's vat validations" ON public.vat_validations;
DROP POLICY IF EXISTS vat_validations_select ON public.vat_validations;
DROP POLICY IF EXISTS vat_validations_update ON public.vat_validations;
DROP POLICY IF EXISTS vat_validations_delete ON public.vat_validations;

CREATE POLICY vat_validations_select ON public.vat_validations
  FOR SELECT TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'accountant'::app_role])
    )
  );

CREATE POLICY vat_validations_update ON public.vat_validations
  FOR UPDATE TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'accountant'::app_role])
    )
  )
  WITH CHECK (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'accountant'::app_role])
    )
  );

CREATE POLICY vat_validations_delete ON public.vat_validations
  FOR DELETE TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'accountant'::app_role])
    )
  );

-- ----------------------------------------------------------------------------
-- vat_report_cache — tighten SELECT; geen schrijfpolicies (service-role only).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their tenant's cache" ON public.vat_report_cache;
DROP POLICY IF EXISTS vat_report_cache_select ON public.vat_report_cache;

CREATE POLICY vat_report_cache_select ON public.vat_report_cache
  FOR SELECT TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'accountant'::app_role])
    )
  );
