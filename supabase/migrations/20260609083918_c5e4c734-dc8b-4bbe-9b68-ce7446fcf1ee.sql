
-- Batch 2F-ii — Procurement/Payment/Integrations dormant lockdown
-- has_tenant_role signature: (_tenant_id uuid, _allowed_roles app_role[])

-- ============= payment_confirmations =============
DROP POLICY IF EXISTS "Tenant users can view payment confirmations" ON public.payment_confirmations;
CREATE POLICY pc_select_members ON public.payment_confirmations FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY pc_update_admin ON public.payment_confirmations FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin','accountant']::app_role[]));
CREATE POLICY pc_delete_admin ON public.payment_confirmations FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY pc_service_role_all ON public.payment_confirmations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============= sync_activity_log =============
DROP POLICY IF EXISTS "Users can insert sync activity for their tenant" ON public.sync_activity_log;
DROP POLICY IF EXISTS "Users can insert sync logs for their tenant" ON public.sync_activity_log;
DROP POLICY IF EXISTS "Users can view their tenant sync activity" ON public.sync_activity_log;
DROP POLICY IF EXISTS "Users can view their tenant's sync logs" ON public.sync_activity_log;
CREATE POLICY sal_select_members ON public.sync_activity_log FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY sal_update_admin ON public.sync_activity_log FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY sal_delete_admin ON public.sync_activity_log FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY sal_service_role_all ON public.sync_activity_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============= sync_conflicts =============
DROP POLICY IF EXISTS "Users can manage their tenant sync conflicts" ON public.sync_conflicts;
DROP POLICY IF EXISTS "Users can view their tenant sync conflicts" ON public.sync_conflicts;
CREATE POLICY sc_select_members ON public.sync_conflicts FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY sc_update_admin ON public.sync_conflicts FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY sc_delete_admin ON public.sync_conflicts FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY sc_service_role_all ON public.sync_conflicts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============= sync_queue =============
DROP POLICY IF EXISTS "Users can manage their tenant's sync queue" ON public.sync_queue;
DROP POLICY IF EXISTS "Users can view their tenant's sync queue" ON public.sync_queue;
CREATE POLICY sq_select_members ON public.sync_queue FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY sq_update_admin ON public.sync_queue FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY sq_delete_admin ON public.sync_queue FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY sq_service_role_all ON public.sync_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============= inventory_sync_log =============
DROP POLICY IF EXISTS "Users can view their tenant's inventory sync logs" ON public.inventory_sync_log;
CREATE POLICY isl_select_members ON public.inventory_sync_log FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY isl_update_admin ON public.inventory_sync_log FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY isl_delete_admin ON public.inventory_sync_log FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY isl_service_role_all ON public.inventory_sync_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============= odoo_customer_sync_log =============
DROP POLICY IF EXISTS "Users can insert Odoo customer sync logs" ON public.odoo_customer_sync_log;
DROP POLICY IF EXISTS "Users can view their tenant's Odoo customer sync logs" ON public.odoo_customer_sync_log;
DROP POLICY IF EXISTS "Users can update their tenant's Odoo customer sync logs" ON public.odoo_customer_sync_log;
CREATE POLICY ocsl_select_members ON public.odoo_customer_sync_log FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY ocsl_update_admin ON public.odoo_customer_sync_log FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY ocsl_delete_admin ON public.odoo_customer_sync_log FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY ocsl_service_role_all ON public.odoo_customer_sync_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============= odoo_invoice_sync_log =============
DROP POLICY IF EXISTS "Users can insert Odoo invoice sync logs" ON public.odoo_invoice_sync_log;
DROP POLICY IF EXISTS "Users can view their tenant's Odoo invoice sync logs" ON public.odoo_invoice_sync_log;
DROP POLICY IF EXISTS "Users can update their tenant's Odoo invoice sync logs" ON public.odoo_invoice_sync_log;
CREATE POLICY oisl_select_members ON public.odoo_invoice_sync_log FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY oisl_update_admin ON public.odoo_invoice_sync_log FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY oisl_delete_admin ON public.odoo_invoice_sync_log FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY oisl_service_role_all ON public.odoo_invoice_sync_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============= webhook_deliveries =============
DROP POLICY IF EXISTS "System can insert deliveries" ON public.webhook_deliveries;
DROP POLICY IF EXISTS "Tenant members can view deliveries" ON public.webhook_deliveries;
CREATE POLICY wd_select_members ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY wd_update_admin ON public.webhook_deliveries FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY wd_delete_admin ON public.webhook_deliveries FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY wd_service_role_all ON public.webhook_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============= storefront_webhooks =============
DROP POLICY IF EXISTS "Tenant admins can manage webhooks" ON public.storefront_webhooks;
DROP POLICY IF EXISTS "Tenant members can view webhooks" ON public.storefront_webhooks;
CREATE POLICY sw_select_members ON public.storefront_webhooks FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY sw_insert_admin ON public.storefront_webhooks FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY sw_update_admin ON public.storefront_webhooks FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY sw_delete_admin ON public.storefront_webhooks FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY sw_service_role_all ON public.storefront_webhooks FOR ALL TO service_role USING (true) WITH CHECK (true);
