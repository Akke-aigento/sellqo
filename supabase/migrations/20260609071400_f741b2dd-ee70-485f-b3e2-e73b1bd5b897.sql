
-- ============================================================================
-- Batch 2D-ii — Settings cluster RLS-aanscherping
-- Bron: docs/fase2-batch-2d-recon.md §5b-5e + beslispunten OB3, OB4, OB6, OB10.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- shipping_methods — OB4: SELECT tenant-scope all roles (already correct);
-- INSERT/UPDATE accountant+admin (was staff); DELETE admin only.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin/staff can insert tenant shipping methods" ON public.shipping_methods;
DROP POLICY IF EXISTS "Admin/staff can update tenant shipping methods" ON public.shipping_methods;
DROP POLICY IF EXISTS "Tenant admins can delete tenant shipping methods" ON public.shipping_methods;
DROP POLICY IF EXISTS "Platform admins can insert any shipping method" ON public.shipping_methods;
DROP POLICY IF EXISTS "Platform admins can update any shipping method" ON public.shipping_methods;
DROP POLICY IF EXISTS "Platform admins can delete any shipping method" ON public.shipping_methods;

CREATE POLICY shipping_methods_insert ON public.shipping_methods
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'accountant'::app_role])
    )
  );

CREATE POLICY shipping_methods_update ON public.shipping_methods
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

CREATE POLICY shipping_methods_delete ON public.shipping_methods
  FOR DELETE TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    )
  );

-- ----------------------------------------------------------------------------
-- vat_rates — OB3: SELECT tenant-scope all roles (already correct);
-- INSERT/UPDATE now tenant_admin + accountant; DELETE tenant_admin only.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenant admins can insert vat rates for their tenant" ON public.vat_rates;
DROP POLICY IF EXISTS "Tenant admins can update their tenant's vat rates" ON public.vat_rates;
DROP POLICY IF EXISTS "Tenant admins can delete their tenant's vat rates" ON public.vat_rates;
DROP POLICY IF EXISTS "Platform admins can insert any vat rate" ON public.vat_rates;
DROP POLICY IF EXISTS "Platform admins can update any vat rate" ON public.vat_rates;
DROP POLICY IF EXISTS "Platform admins can delete any vat rate" ON public.vat_rates;

CREATE POLICY vat_rates_insert ON public.vat_rates
  FOR INSERT TO authenticated
  WITH CHECK (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'accountant'::app_role])
    )
  );

CREATE POLICY vat_rates_update ON public.vat_rates
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

CREATE POLICY vat_rates_delete ON public.vat_rates
  FOR DELETE TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    )
  );

-- ----------------------------------------------------------------------------
-- tenants — OB10 pragmatische aanpak: UPDATE-policy blijft tenant_admin only.
-- Accountants kunnen fiscale kolommen wijzigen via SECURITY DEFINER RPC.
-- Volledige column-level RLS volgt in H3 (tenant_business_info split-table).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_tenant_fiscal_info(
  _tenant_id uuid,
  _vat_number text DEFAULT NULL,
  _iban text DEFAULT NULL,
  _bic text DEFAULT NULL,
  _swift text DEFAULT NULL,
  _kvk_number text DEFAULT NULL,
  _business_address text DEFAULT NULL,
  _business_city text DEFAULT NULL,
  _business_postal_code text DEFAULT NULL,
  _business_country text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Rol-check: alleen tenant_admin, accountant of platform_admin mogen
  -- fiscale info aanpassen. has_tenant_role bevat al platform_admin-bypass.
  IF NOT has_tenant_role(_tenant_id, ARRAY['tenant_admin'::app_role, 'accountant'::app_role]) THEN
    RAISE EXCEPTION 'Insufficient role: only tenant_admin or accountant may update fiscal info'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.tenants
  SET
    vat_number           = COALESCE(_vat_number, vat_number),
    iban                 = COALESCE(_iban, iban),
    bic                  = COALESCE(_bic, bic),
    swift                = COALESCE(_swift, swift),
    kvk_number           = COALESCE(_kvk_number, kvk_number),
    business_address     = COALESCE(_business_address, business_address),
    business_city        = COALESCE(_business_city, business_city),
    business_postal_code = COALESCE(_business_postal_code, business_postal_code),
    business_country     = COALESCE(_business_country, business_country),
    updated_at           = now()
  WHERE id = _tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_tenant_fiscal_info(uuid, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tenant_fiscal_info(uuid, text, text, text, text, text, text, text, text, text) TO authenticated;
