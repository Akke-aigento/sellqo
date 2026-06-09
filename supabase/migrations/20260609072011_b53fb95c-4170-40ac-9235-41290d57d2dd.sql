
-- ============================================================================
-- Batch 2D-iii — Platform-billing strict lockdown
-- Bron: docs/fase2-batch-2d-recon.md §5f + beslispunten OB2, OB9.
-- Service-role behoudt BYPASS RLS → Stripe-webhook + billing-runner blijven.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- platform_invoices — OB2: tenant_admin-zelfservice, geen andere rollen.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenants can view their own invoices" ON public.platform_invoices;
DROP POLICY IF EXISTS platform_invoices_select_tenant ON public.platform_invoices;

CREATE POLICY platform_invoices_select_tenant ON public.platform_invoices
  FOR SELECT TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    )
  );
-- ALL policy "Platform admins can manage all invoices" blijft — dekt
-- INSERT/UPDATE/DELETE voor platform_admin. Geen tenant-write toegestaan.

-- ----------------------------------------------------------------------------
-- pending_platform_payments — idem patroon (OB2).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenants can view own pending payments" ON public.pending_platform_payments;
DROP POLICY IF EXISTS pending_platform_payments_select_tenant ON public.pending_platform_payments;

CREATE POLICY pending_platform_payments_select_tenant ON public.pending_platform_payments
  FOR SELECT TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    )
  );

-- ----------------------------------------------------------------------------
-- subscriptions — OB9: SELECT tenant_admin + accountant; UPDATE tenant_admin
-- only; INSERT/DELETE platform_admin only.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS subscriptions_select ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_insert ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_update ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_delete ON public.subscriptions;

CREATE POLICY subscriptions_select ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'accountant'::app_role])
    )
  );

CREATE POLICY subscriptions_insert ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY subscriptions_update ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    )
  )
  WITH CHECK (
    is_platform_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
      AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    )
  );

CREATE POLICY subscriptions_delete ON public.subscriptions
  FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- subscription_invoices — SELECT tenant_admin+accountant via subscription;
-- INSERT/UPDATE/DELETE platform_admin only (billing-runner via service-role).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS subscription_invoices_select ON public.subscription_invoices;
DROP POLICY IF EXISTS subscription_invoices_insert_admin ON public.subscription_invoices;
DROP POLICY IF EXISTS subscription_invoices_update ON public.subscription_invoices;
DROP POLICY IF EXISTS subscription_invoices_delete ON public.subscription_invoices;

CREATE POLICY subscription_invoices_select ON public.subscription_invoices
  FOR SELECT TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR subscription_id IN (
      SELECT s.id FROM public.subscriptions s
      WHERE s.tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
        AND has_tenant_role(s.tenant_id, ARRAY['tenant_admin'::app_role, 'accountant'::app_role])
    )
  );

CREATE POLICY subscription_invoices_insert ON public.subscription_invoices
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY subscription_invoices_update ON public.subscription_invoices
  FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY subscription_invoices_delete ON public.subscription_invoices
  FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- subscription_lines — SELECT tenant_admin+accountant via subscription;
-- writes platform_admin only.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenant users can manage subscription lines" ON public.subscription_lines;
DROP POLICY IF EXISTS subscription_lines_select ON public.subscription_lines;
DROP POLICY IF EXISTS subscription_lines_write ON public.subscription_lines;

CREATE POLICY subscription_lines_select ON public.subscription_lines
  FOR SELECT TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR subscription_id IN (
      SELECT s.id FROM public.subscriptions s
      WHERE s.tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
        AND has_tenant_role(s.tenant_id, ARRAY['tenant_admin'::app_role, 'accountant'::app_role])
    )
  );

CREATE POLICY subscription_lines_insert ON public.subscription_lines
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY subscription_lines_update ON public.subscription_lines
  FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY subscription_lines_delete ON public.subscription_lines
  FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- subscription_notifications — zelfde patroon.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenant users can manage subscription notifications" ON public.subscription_notifications;
DROP POLICY IF EXISTS subscription_notifications_select ON public.subscription_notifications;
DROP POLICY IF EXISTS subscription_notifications_write ON public.subscription_notifications;

CREATE POLICY subscription_notifications_select ON public.subscription_notifications
  FOR SELECT TO authenticated
  USING (
    is_platform_admin(auth.uid())
    OR subscription_id IN (
      SELECT s.id FROM public.subscriptions s
      WHERE s.tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
        AND has_tenant_role(s.tenant_id, ARRAY['tenant_admin'::app_role, 'accountant'::app_role])
    )
  );

CREATE POLICY subscription_notifications_insert ON public.subscription_notifications
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY subscription_notifications_update ON public.subscription_notifications
  FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY subscription_notifications_delete ON public.subscription_notifications
  FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()));
