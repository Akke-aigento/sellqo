
-- =====================================================================
-- Batch 2C2a-iv — CMS/SEO/Theme/Social/A-B/Notifications RLS
-- Recon ref: docs/fase2-batch-2c2-recon.md cluster 4 + 5
-- Bevestigde beslispunten: §7-6, §7-7, §7-12, §7-13, §7-14, §7-15
-- =====================================================================

-- =====================================================================
-- CONTENT cluster — marketing RW (members read)
-- Public/anon SELECT policies (storefront) blijven behouden.
-- =====================================================================

-- storefront_pages
DROP POLICY IF EXISTS "Tenant members can view pages" ON public.storefront_pages;
DROP POLICY IF EXISTS "Tenant members can insert pages" ON public.storefront_pages;
DROP POLICY IF EXISTS "Tenant members can update pages" ON public.storefront_pages;
DROP POLICY IF EXISTS "Tenant members can delete pages" ON public.storefront_pages;
CREATE POLICY "storefront_pages_select_members" ON public.storefront_pages FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "storefront_pages_insert_marketing" ON public.storefront_pages FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "storefront_pages_update_marketing" ON public.storefront_pages FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "storefront_pages_delete_marketing" ON public.storefront_pages FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

-- homepage_sections
DROP POLICY IF EXISTS "Tenant members can view sections" ON public.homepage_sections;
DROP POLICY IF EXISTS "Tenant members can insert sections" ON public.homepage_sections;
DROP POLICY IF EXISTS "Tenant members can update sections" ON public.homepage_sections;
DROP POLICY IF EXISTS "Tenant members can delete sections" ON public.homepage_sections;
CREATE POLICY "homepage_sections_select_members" ON public.homepage_sections FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "homepage_sections_insert_marketing" ON public.homepage_sections FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "homepage_sections_update_marketing" ON public.homepage_sections FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "homepage_sections_delete_marketing" ON public.homepage_sections FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

-- legal_pages
DROP POLICY IF EXISTS "Tenants can view their own legal pages" ON public.legal_pages;
DROP POLICY IF EXISTS "Tenants can insert their own legal pages" ON public.legal_pages;
DROP POLICY IF EXISTS "Tenants can update their own legal pages" ON public.legal_pages;
DROP POLICY IF EXISTS "Tenants can delete their own legal pages" ON public.legal_pages;
CREATE POLICY "legal_pages_select_members" ON public.legal_pages FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "legal_pages_insert_marketing" ON public.legal_pages FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "legal_pages_update_marketing" ON public.legal_pages FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "legal_pages_delete_marketing" ON public.legal_pages FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

-- social_posts
DROP POLICY IF EXISTS "Users can view their tenant social posts" ON public.social_posts;
DROP POLICY IF EXISTS "Users can insert social posts" ON public.social_posts;
DROP POLICY IF EXISTS "Users can update their tenant social posts" ON public.social_posts;
DROP POLICY IF EXISTS "Users can delete their tenant social posts" ON public.social_posts;
CREATE POLICY "social_posts_select_members" ON public.social_posts FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "social_posts_insert_marketing" ON public.social_posts FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "social_posts_update_marketing" ON public.social_posts FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "social_posts_delete_marketing" ON public.social_posts FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

-- message_templates
DROP POLICY IF EXISTS "Users can view message templates for their tenants" ON public.message_templates;
DROP POLICY IF EXISTS "Users can create message templates for their tenants" ON public.message_templates;
DROP POLICY IF EXISTS "Users can update message templates for their tenants" ON public.message_templates;
DROP POLICY IF EXISTS "Users can delete message templates for their tenants" ON public.message_templates;
CREATE POLICY "message_templates_select_members" ON public.message_templates FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "message_templates_insert_marketing" ON public.message_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "message_templates_update_marketing" ON public.message_templates FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "message_templates_delete_marketing" ON public.message_templates FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

-- whatsapp_templates (drop blanket ALL)
DROP POLICY IF EXISTS "Tenant admins can manage whatsapp templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Users can view their tenant whatsapp templates" ON public.whatsapp_templates;
CREATE POLICY "whatsapp_templates_select_members" ON public.whatsapp_templates FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "whatsapp_templates_insert_marketing" ON public.whatsapp_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "whatsapp_templates_update_marketing" ON public.whatsapp_templates FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "whatsapp_templates_delete_marketing" ON public.whatsapp_templates FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

-- =====================================================================
-- SEO research tables (marketing RW)
-- =====================================================================

-- seo_keywords — overlap-consolidatie (drop blanket ALL + per-cmd legacy)
DROP POLICY IF EXISTS "Users can manage SEO keywords" ON public.seo_keywords;
DROP POLICY IF EXISTS "Users can view SEO keywords" ON public.seo_keywords;
DROP POLICY IF EXISTS "Users can create SEO keywords for their tenant" ON public.seo_keywords;
DROP POLICY IF EXISTS "Users can update their tenant's SEO keywords" ON public.seo_keywords;
DROP POLICY IF EXISTS "Users can delete their tenant's SEO keywords" ON public.seo_keywords;
CREATE POLICY "seo_keywords_select_members" ON public.seo_keywords FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "seo_keywords_insert_marketing" ON public.seo_keywords FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "seo_keywords_update_marketing" ON public.seo_keywords FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "seo_keywords_delete_marketing" ON public.seo_keywords FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

-- seo_competitors
DROP POLICY IF EXISTS "Users can view their tenant's competitors" ON public.seo_competitors;
DROP POLICY IF EXISTS "Users can insert their tenant's competitors" ON public.seo_competitors;
DROP POLICY IF EXISTS "Users can update their tenant's competitors" ON public.seo_competitors;
DROP POLICY IF EXISTS "Users can delete their tenant's competitors" ON public.seo_competitors;
CREATE POLICY "seo_competitors_select_members" ON public.seo_competitors FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "seo_competitors_insert_marketing" ON public.seo_competitors FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "seo_competitors_update_marketing" ON public.seo_competitors FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "seo_competitors_delete_marketing" ON public.seo_competitors FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

-- seo_competitor_keywords
DROP POLICY IF EXISTS "Users can view their tenant's competitor keywords" ON public.seo_competitor_keywords;
DROP POLICY IF EXISTS "Users can insert their tenant's competitor keywords" ON public.seo_competitor_keywords;
DROP POLICY IF EXISTS "Users can update their tenant's competitor keywords" ON public.seo_competitor_keywords;
DROP POLICY IF EXISTS "Users can delete their tenant's competitor keywords" ON public.seo_competitor_keywords;
CREATE POLICY "seo_competitor_keywords_select_members" ON public.seo_competitor_keywords FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "seo_competitor_keywords_insert_marketing" ON public.seo_competitor_keywords FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "seo_competitor_keywords_update_marketing" ON public.seo_competitor_keywords FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "seo_competitor_keywords_delete_marketing" ON public.seo_competitor_keywords FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

-- seo_scheduled_audits
DROP POLICY IF EXISTS "Users can view their tenant's scheduled audits" ON public.seo_scheduled_audits;
DROP POLICY IF EXISTS "Users can insert their tenant's scheduled audits" ON public.seo_scheduled_audits;
DROP POLICY IF EXISTS "Users can update their tenant's scheduled audits" ON public.seo_scheduled_audits;
DROP POLICY IF EXISTS "Users can delete their tenant's scheduled audits" ON public.seo_scheduled_audits;
CREATE POLICY "seo_scheduled_audits_select_members" ON public.seo_scheduled_audits FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "seo_scheduled_audits_insert_marketing" ON public.seo_scheduled_audits FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "seo_scheduled_audits_update_marketing" ON public.seo_scheduled_audits FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "seo_scheduled_audits_delete_marketing" ON public.seo_scheduled_audits FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

-- =====================================================================
-- SEO RESULT tables (runner = service-role insert)
-- =====================================================================

-- seo_scores — overlap-consolidatie (drop blanket ALL + legacy SELECT)
DROP POLICY IF EXISTS "Users can manage SEO scores" ON public.seo_scores;
DROP POLICY IF EXISTS "Users can view SEO scores" ON public.seo_scores;
CREATE POLICY "seo_scores_select_members" ON public.seo_scores FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
-- INSERT: service-role only (no auth-policy)
CREATE POLICY "seo_scores_update_admin" ON public.seo_scores FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "seo_scores_delete_admin" ON public.seo_scores FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- seo_audit_results
DROP POLICY IF EXISTS "Users can view their tenant's audit results" ON public.seo_audit_results;
DROP POLICY IF EXISTS "Users can insert their tenant's audit results" ON public.seo_audit_results;
CREATE POLICY "seo_audit_results_select_members" ON public.seo_audit_results FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "seo_audit_results_update_admin" ON public.seo_audit_results FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "seo_audit_results_delete_admin" ON public.seo_audit_results FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- seo_search_console_data
DROP POLICY IF EXISTS "Users can view their tenant's search console data" ON public.seo_search_console_data;
DROP POLICY IF EXISTS "Users can insert their tenant's search console data" ON public.seo_search_console_data;
CREATE POLICY "seo_search_console_select_members" ON public.seo_search_console_data FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "seo_search_console_update_admin" ON public.seo_search_console_data FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "seo_search_console_delete_admin" ON public.seo_search_console_data FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- seo_web_vitals
DROP POLICY IF EXISTS "Users can view their tenant's web vitals" ON public.seo_web_vitals;
DROP POLICY IF EXISTS "Users can insert their tenant's web vitals" ON public.seo_web_vitals;
CREATE POLICY "seo_web_vitals_select_members" ON public.seo_web_vitals FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "seo_web_vitals_update_admin" ON public.seo_web_vitals FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "seo_web_vitals_delete_admin" ON public.seo_web_vitals FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- =====================================================================
-- THEME (tenant_admin only writes — §7-13)
-- =====================================================================

-- tenant_theme_settings
DROP POLICY IF EXISTS "Tenant members can view theme settings" ON public.tenant_theme_settings;
DROP POLICY IF EXISTS "Tenant members can insert theme settings" ON public.tenant_theme_settings;
DROP POLICY IF EXISTS "Tenant members can update theme settings" ON public.tenant_theme_settings;
CREATE POLICY "tenant_theme_settings_select_members" ON public.tenant_theme_settings FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "tenant_theme_settings_insert_admin" ON public.tenant_theme_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "tenant_theme_settings_update_admin" ON public.tenant_theme_settings FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "tenant_theme_settings_delete_admin" ON public.tenant_theme_settings FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- tenant_theme_presets
DROP POLICY IF EXISTS "Tenants can view their own presets" ON public.tenant_theme_presets;
DROP POLICY IF EXISTS "Tenants can create their own presets" ON public.tenant_theme_presets;
DROP POLICY IF EXISTS "Tenants can delete their own presets" ON public.tenant_theme_presets;
CREATE POLICY "tenant_theme_presets_select_members" ON public.tenant_theme_presets FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "tenant_theme_presets_insert_admin" ON public.tenant_theme_presets FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "tenant_theme_presets_update_admin" ON public.tenant_theme_presets FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "tenant_theme_presets_delete_admin" ON public.tenant_theme_presets FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- =====================================================================
-- SOCIAL OAUTH (tenant_admin only — §7-12)
-- =====================================================================

-- social_connections
DROP POLICY IF EXISTS "Users can view their tenant social connections" ON public.social_connections;
DROP POLICY IF EXISTS "Users can insert social connections" ON public.social_connections;
DROP POLICY IF EXISTS "Users can update their tenant social connections" ON public.social_connections;
DROP POLICY IF EXISTS "Users can delete their tenant social connections" ON public.social_connections;
CREATE POLICY "social_connections_select_admin" ON public.social_connections FOR SELECT TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "social_connections_insert_admin" ON public.social_connections FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "social_connections_update_admin" ON public.social_connections FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "social_connections_delete_admin" ON public.social_connections FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- social_channel_connections
DROP POLICY IF EXISTS "Users can view their tenant's social channel connections" ON public.social_channel_connections;
DROP POLICY IF EXISTS "Users can create social channel connections for their tenant" ON public.social_channel_connections;
DROP POLICY IF EXISTS "Users can update their tenant's social channel connections" ON public.social_channel_connections;
DROP POLICY IF EXISTS "Users can delete their tenant's social channel connections" ON public.social_channel_connections;
CREATE POLICY "social_channel_connections_select_admin" ON public.social_channel_connections FOR SELECT TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "social_channel_connections_insert_admin" ON public.social_channel_connections FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "social_channel_connections_update_admin" ON public.social_channel_connections FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "social_channel_connections_delete_admin" ON public.social_channel_connections FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- =====================================================================
-- A/B TESTS — ab_test_configs (marketing RW)
-- =====================================================================
DROP POLICY IF EXISTS "Users can view their tenant ab_test_configs" ON public.ab_test_configs;
DROP POLICY IF EXISTS "Users can insert their tenant ab_test_configs" ON public.ab_test_configs;
DROP POLICY IF EXISTS "Users can update their tenant ab_test_configs" ON public.ab_test_configs;
DROP POLICY IF EXISTS "Users can delete their tenant ab_test_configs" ON public.ab_test_configs;
CREATE POLICY "ab_test_configs_select_members" ON public.ab_test_configs FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "ab_test_configs_insert_marketing" ON public.ab_test_configs FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "ab_test_configs_update_marketing" ON public.ab_test_configs FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "ab_test_configs_delete_marketing" ON public.ab_test_configs FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

-- =====================================================================
-- NOTIFICATIONS (§7-14)
-- =====================================================================

-- notifications
DROP POLICY IF EXISTS "Users can view their tenant notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications for their tenant" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their tenant notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their tenant notifications" ON public.notifications;
CREATE POLICY "notifications_select_members" ON public.notifications FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "notifications_insert_staff" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "notifications_update_self_or_staff" ON public.notifications FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[])
  );
CREATE POLICY "notifications_delete_staff" ON public.notifications FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));

-- tenant_notification_settings
DROP POLICY IF EXISTS "Users can view their tenant notification settings" ON public.tenant_notification_settings;
DROP POLICY IF EXISTS "Users can insert notification settings for their tenant" ON public.tenant_notification_settings;
DROP POLICY IF EXISTS "Users can update their tenant notification settings" ON public.tenant_notification_settings;
DROP POLICY IF EXISTS "Users can delete their tenant notification settings" ON public.tenant_notification_settings;
CREATE POLICY "tenant_notif_settings_select_members" ON public.tenant_notification_settings FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "tenant_notif_settings_insert_admin" ON public.tenant_notification_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "tenant_notif_settings_update_admin" ON public.tenant_notification_settings FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "tenant_notif_settings_delete_admin" ON public.tenant_notification_settings FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
