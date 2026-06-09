-- Batch 2F-iii: Ads-restant + Analytics/Tracking dormant lockdown
-- ADS-restant: alle ads_* tabellen reeds gehard in 2C2a-iii (has_tenant_role).
-- Deze migration focust op analytics/tracking tabellen die nog tenant-blind waren.

-- ============================================================
-- customer_events (event-log, immutable)
-- ============================================================
DROP POLICY IF EXISTS "Tenants can view own events" ON public.customer_events;

CREATE POLICY "customer_events_select_members"
  ON public.customer_events FOR SELECT TO authenticated
  USING (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role,'staff'::app_role,'marketing'::app_role,'accountant'::app_role])
    OR is_platform_admin(auth.uid())
  );

CREATE POLICY "customer_events_delete_admin"
  ON public.customer_events FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]) OR is_platform_admin(auth.uid()));

CREATE POLICY "customer_events_service_role_all"
  ON public.customer_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- feature_usage_events (event-log, user-driven inserts)
-- ============================================================
DROP POLICY IF EXISTS "Platform admins can view all feature usage" ON public.feature_usage_events;

CREATE POLICY "feature_usage_events_select_members"
  ON public.feature_usage_events FOR SELECT TO authenticated
  USING (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role,'staff'::app_role,'marketing'::app_role,'accountant'::app_role])
    OR is_platform_admin(auth.uid())
  );

CREATE POLICY "feature_usage_events_delete_admin"
  ON public.feature_usage_events FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]) OR is_platform_admin(auth.uid()));

CREATE POLICY "feature_usage_events_service_role_all"
  ON public.feature_usage_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- tracking_import_log (fulfillment log)
-- ============================================================
DROP POLICY IF EXISTS "Users can view their tenant import logs" ON public.tracking_import_log;

CREATE POLICY "tracking_import_log_select_members"
  ON public.tracking_import_log FOR SELECT TO authenticated
  USING (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role,'staff'::app_role,'warehouse'::app_role,'accountant'::app_role])
    OR is_platform_admin(auth.uid())
  );

CREATE POLICY "tracking_import_log_delete_admin"
  ON public.tracking_import_log FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]) OR is_platform_admin(auth.uid()));

CREATE POLICY "tracking_import_log_service_role_all"
  ON public.tracking_import_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);
