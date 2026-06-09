-- Batch 2F-iv: Customer-extras + Product-extras + AI-engine + Uncategorized dormant lockdown
-- LAATSTE 2F split. Niet-bestaande tabellen (customer_referrals, referral_rewards,
-- gdpr_*, product_recommendations, product_compatibility*, product_search_logs)
-- gedocumenteerd in role-audit. email_unsubscribes reeds gehard. Overige customer_*/
-- product_*/ai_* tabellen reeds gehard in 2B2 / 2C1 / 2C2.

-- ============================================================
-- storefront_favorites (RLS enabled, geen policies = locked)
-- tenant_id aanwezig — geen EXISTS-join nodig
-- ============================================================
CREATE POLICY "storefront_favorites_select_members"
  ON public.storefront_favorites FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    OR is_platform_admin(auth.uid())
  );

CREATE POLICY "storefront_favorites_delete_admin"
  ON public.storefront_favorites FOR DELETE TO authenticated
  USING (
    has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])
    OR is_platform_admin(auth.uid())
  );

CREATE POLICY "storefront_favorites_service_role_all"
  ON public.storefront_favorites FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- ai_help_conversations (AI-engine read-only-UI patroon, OB-2F-2)
-- ============================================================
DROP POLICY IF EXISTS "Users can read own help conversations" ON public.ai_help_conversations;
DROP POLICY IF EXISTS "Users can insert own help conversations" ON public.ai_help_conversations;
DROP POLICY IF EXISTS "Users can update own help conversations" ON public.ai_help_conversations;

CREATE POLICY "ai_help_conversations_select_members"
  ON public.ai_help_conversations FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    OR is_platform_admin(auth.uid())
  );

CREATE POLICY "ai_help_conversations_update_admin"
  ON public.ai_help_conversations FOR UPDATE TO authenticated
  USING (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]) OR is_platform_admin(auth.uid()))
  WITH CHECK (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]) OR is_platform_admin(auth.uid()));

CREATE POLICY "ai_help_conversations_delete_admin"
  ON public.ai_help_conversations FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]) OR is_platform_admin(auth.uid()));

CREATE POLICY "ai_help_conversations_service_role_all"
  ON public.ai_help_conversations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- ai_help_unanswered (AI-engine, read-only-UI)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert unanswered questions" ON public.ai_help_unanswered;
DROP POLICY IF EXISTS "Platform admins can read unanswered questions" ON public.ai_help_unanswered;
DROP POLICY IF EXISTS "Platform admins can update unanswered questions" ON public.ai_help_unanswered;

CREATE POLICY "ai_help_unanswered_select_members"
  ON public.ai_help_unanswered FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    OR is_platform_admin(auth.uid())
  );

CREATE POLICY "ai_help_unanswered_update_admin"
  ON public.ai_help_unanswered FOR UPDATE TO authenticated
  USING (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]) OR is_platform_admin(auth.uid()))
  WITH CHECK (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]) OR is_platform_admin(auth.uid()));

CREATE POLICY "ai_help_unanswered_delete_admin"
  ON public.ai_help_unanswered FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]) OR is_platform_admin(auth.uid()));

CREATE POLICY "ai_help_unanswered_service_role_all"
  ON public.ai_help_unanswered FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- ai_knowledge_index (AI-engine, vervang recursieve user_roles lookup)
-- ============================================================
DROP POLICY IF EXISTS "Tenant isolation for ai_knowledge_index" ON public.ai_knowledge_index;
DROP POLICY IF EXISTS "Tenant users can view knowledge" ON public.ai_knowledge_index;

CREATE POLICY "ai_knowledge_index_select_members"
  ON public.ai_knowledge_index FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
    OR is_platform_admin(auth.uid())
  );

CREATE POLICY "ai_knowledge_index_update_admin"
  ON public.ai_knowledge_index FOR UPDATE TO authenticated
  USING (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]) OR is_platform_admin(auth.uid()))
  WITH CHECK (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]) OR is_platform_admin(auth.uid()));

CREATE POLICY "ai_knowledge_index_delete_admin"
  ON public.ai_knowledge_index FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role]) OR is_platform_admin(auth.uid()));

CREATE POLICY "ai_knowledge_index_service_role_all"
  ON public.ai_knowledge_index FOR ALL TO service_role
  USING (true) WITH CHECK (true);
