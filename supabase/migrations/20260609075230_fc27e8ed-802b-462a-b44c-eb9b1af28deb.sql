-- Batch 2E — POS RLS hardening
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname='public' AND tablename IN (
      'pos_sessions','pos_transactions','pos_cash_movements',
      'pos_parked_carts','pos_offline_queue','pos_cashiers',
      'pos_terminals','pos_quick_buttons'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Operational tables
CREATE POLICY "pos_sessions_select" ON public.pos_sessions FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY "pos_sessions_insert" ON public.pos_sessions FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "pos_sessions_update" ON public.pos_sessions FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]))
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "pos_sessions_delete" ON public.pos_sessions FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "pos_sessions_service_role" ON public.pos_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "pos_transactions_select" ON public.pos_transactions FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY "pos_transactions_insert" ON public.pos_transactions FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "pos_transactions_update" ON public.pos_transactions FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]))
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "pos_transactions_delete" ON public.pos_transactions FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "pos_transactions_service_role" ON public.pos_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "pos_cash_movements_select" ON public.pos_cash_movements FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY "pos_cash_movements_insert" ON public.pos_cash_movements FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "pos_cash_movements_update" ON public.pos_cash_movements FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]))
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "pos_cash_movements_delete" ON public.pos_cash_movements FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "pos_cash_movements_service_role" ON public.pos_cash_movements FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "pos_parked_carts_select" ON public.pos_parked_carts FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY "pos_parked_carts_insert" ON public.pos_parked_carts FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "pos_parked_carts_update" ON public.pos_parked_carts FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]))
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "pos_parked_carts_delete" ON public.pos_parked_carts FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "pos_parked_carts_service_role" ON public.pos_parked_carts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "pos_offline_queue_select" ON public.pos_offline_queue FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','accountant']::app_role[]));
CREATE POLICY "pos_offline_queue_insert" ON public.pos_offline_queue FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "pos_offline_queue_update" ON public.pos_offline_queue FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]))
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "pos_offline_queue_delete" ON public.pos_offline_queue FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "pos_offline_queue_service_role" ON public.pos_offline_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- pos_cashiers (PIN-management)
CREATE POLICY "pos_cashiers_select" ON public.pos_cashiers FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "pos_cashiers_insert" ON public.pos_cashiers FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "pos_cashiers_update" ON public.pos_cashiers FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "pos_cashiers_delete" ON public.pos_cashiers FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "pos_cashiers_service_role" ON public.pos_cashiers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- pos_terminals (config)
CREATE POLICY "pos_terminals_select" ON public.pos_terminals FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "pos_terminals_insert" ON public.pos_terminals FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "pos_terminals_update" ON public.pos_terminals FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "pos_terminals_delete" ON public.pos_terminals FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "pos_terminals_service_role" ON public.pos_terminals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- pos_quick_buttons (UI-content)
CREATE POLICY "pos_quick_buttons_select" ON public.pos_quick_buttons FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()) OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "pos_quick_buttons_insert" ON public.pos_quick_buttons FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "pos_quick_buttons_update" ON public.pos_quick_buttons FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
WITH CHECK (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "pos_quick_buttons_delete" ON public.pos_quick_buttons FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()) OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "pos_quick_buttons_service_role" ON public.pos_quick_buttons FOR ALL TO service_role USING (true) WITH CHECK (true);
