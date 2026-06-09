
-- ============================================================
-- Batch 2F-i — Marketing-extras + Loyalty-restant + SEO dormant lockdown
-- Date: 2026-06-09
-- Recon: docs/fase2-batch-2f-recon.md
-- Decisions: OB-2F-7 (loyalty log-pattern), OB-2F-8 (SEO search-console SELECT)
-- ============================================================

-- ---------- tenant_loyalty_rewards ----------
DROP POLICY IF EXISTS "Platform admins can manage loyalty rewards" ON public.tenant_loyalty_rewards;

CREATE POLICY "tenant_loyalty_rewards_select_members"
ON public.tenant_loyalty_rewards FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "tenant_loyalty_rewards_insert_service"
ON public.tenant_loyalty_rewards FOR INSERT TO authenticated
WITH CHECK (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));

CREATE POLICY "tenant_loyalty_rewards_update_admin"
ON public.tenant_loyalty_rewards FOR UPDATE TO authenticated
USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]))
WITH CHECK (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]));

CREATE POLICY "tenant_loyalty_rewards_delete_admin"
ON public.tenant_loyalty_rewards FOR DELETE TO authenticated
USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]));

CREATE POLICY "tenant_loyalty_rewards_service_role_all"
ON public.tenant_loyalty_rewards FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ---------- loyalty_transactions (OB-2F-7: log-pattern) ----------
-- Existing SELECT/UPDATE/DELETE keep their join-based has_tenant_role logic.
-- Add platform_admin SELECT bypass for support flows + explicit service-role policy.
DROP POLICY IF EXISTS "loyalty_transactions_select_platform_admin" ON public.loyalty_transactions;
CREATE POLICY "loyalty_transactions_select_platform_admin"
ON public.loyalty_transactions FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "loyalty_transactions_service_role_all" ON public.loyalty_transactions;
CREATE POLICY "loyalty_transactions_service_role_all"
ON public.loyalty_transactions FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ---------- seo_search_console_data (OB-2F-8) ----------
DROP POLICY IF EXISTS "seo_search_console_select_members" ON public.seo_search_console_data;
DROP POLICY IF EXISTS "seo_search_console_update_admin" ON public.seo_search_console_data;
DROP POLICY IF EXISTS "seo_search_console_delete_admin" ON public.seo_search_console_data;

CREATE POLICY "seo_search_console_select_members"
ON public.seo_search_console_data FOR SELECT TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role, 'viewer'::app_role, 'accountant'::app_role])
);

CREATE POLICY "seo_search_console_update_admin"
ON public.seo_search_console_data FOR UPDATE TO authenticated
USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]))
WITH CHECK (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]));

CREATE POLICY "seo_search_console_delete_admin"
ON public.seo_search_console_data FOR DELETE TO authenticated
USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]));

DROP POLICY IF EXISTS "seo_search_console_service_role_all" ON public.seo_search_console_data;
CREATE POLICY "seo_search_console_service_role_all"
ON public.seo_search_console_data FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ---------- seo_analysis_history (log-pattern) ----------
DROP POLICY IF EXISTS "Users can view SEO history" ON public.seo_analysis_history;
DROP POLICY IF EXISTS "Users can create SEO history" ON public.seo_analysis_history;

CREATE POLICY "seo_analysis_history_select_members"
ON public.seo_analysis_history FOR SELECT TO authenticated
USING (
  is_platform_admin(auth.uid())
  OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'marketing'::app_role, 'viewer'::app_role, 'accountant'::app_role])
);

CREATE POLICY "seo_analysis_history_insert_admin"
ON public.seo_analysis_history FOR INSERT TO authenticated
WITH CHECK (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'marketing'::app_role]));

CREATE POLICY "seo_analysis_history_delete_admin"
ON public.seo_analysis_history FOR DELETE TO authenticated
USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]));

CREATE POLICY "seo_analysis_history_service_role_all"
ON public.seo_analysis_history FOR ALL TO service_role
USING (true) WITH CHECK (true);
