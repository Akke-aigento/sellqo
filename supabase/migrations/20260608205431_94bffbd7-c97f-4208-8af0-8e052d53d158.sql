
-- Batch 2C2a-iii — Ads-platforms RLS-aanscherping
-- Recon ref: docs/fase2-batch-2c2-recon.md cluster 3 + beslispunt §7-2

-- ====================== GROUP A ======================
DROP POLICY IF EXISTS "Tenant admins can manage campaigns" ON public.ad_campaigns;
DROP POLICY IF EXISTS "Tenant users can view their campaigns" ON public.ad_campaigns;
CREATE POLICY "ad_campaigns_select_members" ON public.ad_campaigns FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "ad_campaigns_insert_marketing" ON public.ad_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "ad_campaigns_update_marketing" ON public.ad_campaigns FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "ad_campaigns_delete_marketing" ON public.ad_campaigns FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

DROP POLICY IF EXISTS "Tenant admins can manage creatives" ON public.ad_creatives;
DROP POLICY IF EXISTS "Tenant users can view their creatives" ON public.ad_creatives;
CREATE POLICY "ad_creatives_select_members" ON public.ad_creatives FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "ad_creatives_insert_marketing" ON public.ad_creatives FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "ad_creatives_update_marketing" ON public.ad_creatives FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "ad_creatives_delete_marketing" ON public.ad_creatives FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

DROP POLICY IF EXISTS "Tenant admins can manage audience syncs" ON public.ad_audience_syncs;
DROP POLICY IF EXISTS "Tenant users can view their audience syncs" ON public.ad_audience_syncs;
CREATE POLICY "ad_audience_syncs_select_members" ON public.ad_audience_syncs FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "ad_audience_syncs_insert_marketing" ON public.ad_audience_syncs FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "ad_audience_syncs_update_marketing" ON public.ad_audience_syncs FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "ad_audience_syncs_delete_marketing" ON public.ad_audience_syncs FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

DROP POLICY IF EXISTS "ads_ai_rules_select" ON public.ads_ai_rules;
DROP POLICY IF EXISTS "ads_ai_rules_insert" ON public.ads_ai_rules;
DROP POLICY IF EXISTS "ads_ai_rules_update" ON public.ads_ai_rules;
DROP POLICY IF EXISTS "ads_ai_rules_delete" ON public.ads_ai_rules;
CREATE POLICY "ads_ai_rules_select_members" ON public.ads_ai_rules FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "ads_ai_rules_insert_marketing" ON public.ads_ai_rules FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "ads_ai_rules_update_marketing" ON public.ads_ai_rules FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "ads_ai_rules_delete_marketing" ON public.ads_ai_rules FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

DROP POLICY IF EXISTS "ads_product_channel_map_select" ON public.ads_product_channel_map;
DROP POLICY IF EXISTS "ads_product_channel_map_insert" ON public.ads_product_channel_map;
DROP POLICY IF EXISTS "ads_product_channel_map_update" ON public.ads_product_channel_map;
DROP POLICY IF EXISTS "ads_product_channel_map_delete" ON public.ads_product_channel_map;
CREATE POLICY "ads_pcm_select_members" ON public.ads_product_channel_map FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "ads_pcm_insert_marketing" ON public.ads_product_channel_map FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "ads_pcm_update_marketing" ON public.ads_product_channel_map FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "ads_pcm_delete_marketing" ON public.ads_product_channel_map FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));

DO $$
DECLARE
  t text;
  cfg_tables text[] := ARRAY[
    'ads_amazon_campaigns','ads_amazon_adgroups','ads_amazon_keywords',
    'ads_bolcom_campaigns','ads_bolcom_adgroups','ads_bolcom_keywords','ads_bolcom_targeting_products',
    'ads_google_campaigns',
    'ads_meta_campaigns','ads_meta_adsets'
  ];
  drop_names text[] := ARRAY[
    'tenant_select','tenant_insert','tenant_update','tenant_delete',
    'Users can view their tenant bolcom adgroups','Users can insert their tenant bolcom adgroups','Users can update their tenant bolcom adgroups','Users can delete their tenant bolcom adgroups',
    'Users can view their tenant bolcom campaigns','Users can insert their tenant bolcom campaigns','Users can update their tenant bolcom campaigns','Users can delete their tenant bolcom campaigns',
    'Users can view their tenant bolcom keywords','Users can insert their tenant bolcom keywords','Users can update their tenant bolcom keywords','Users can delete their tenant bolcom keywords',
    'Users can view their tenant bolcom targeting products','Users can insert their tenant bolcom targeting products','Users can update their tenant bolcom targeting products','Users can delete their tenant bolcom targeting products'
  ];
  d text;
BEGIN
  FOREACH t IN ARRAY cfg_tables LOOP
    FOREACH d IN ARRAY drop_names LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', d, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));', t || '_select_members', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_tenant_role(tenant_id, ARRAY[''tenant_admin'',''staff'',''marketing'']::public.app_role[]));', t || '_insert_marketing', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY[''tenant_admin'',''staff'',''marketing'']::public.app_role[])) WITH CHECK (public.has_tenant_role(tenant_id, ARRAY[''tenant_admin'',''staff'',''marketing'']::public.app_role[]));', t || '_update_marketing', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY[''tenant_admin'',''staff'',''marketing'']::public.app_role[]));', t || '_delete_marketing', t);
  END LOOP;
END $$;

-- ====================== GROUP B (performance + search_terms) ======================
-- Note: ads_global_daily_summary is a VIEW — inherits RLS from underlying perf tables.
DO $$
DECLARE
  t text;
  perf_tables text[] := ARRAY[
    'ads_amazon_performance','ads_amazon_search_terms',
    'ads_bolcom_performance','ads_bolcom_search_terms',
    'ads_google_performance','ads_meta_performance'
  ];
  drop_names text[] := ARRAY[
    'tenant_select','tenant_insert','tenant_update','tenant_delete',
    'Users can view their tenant bolcom performance','Users can insert their tenant bolcom performance','Users can update their tenant bolcom performance','Users can delete their tenant bolcom performance',
    'Users can view their tenant bolcom search terms','Users can insert their tenant bolcom search terms','Users can update their tenant bolcom search terms','Users can delete their tenant bolcom search terms'
  ];
  d text;
BEGIN
  FOREACH t IN ARRAY perf_tables LOOP
    FOREACH d IN ARRAY drop_names LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', d, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));', t || '_select_members', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_tenant_role(tenant_id, ARRAY[''tenant_admin'',''staff'',''marketing'']::public.app_role[]));', t || '_insert_marketing', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY[''tenant_admin'',''staff'',''marketing'']::public.app_role[])) WITH CHECK (public.has_tenant_role(tenant_id, ARRAY[''tenant_admin'',''staff'',''marketing'']::public.app_role[]));', t || '_update_marketing', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY[''tenant_admin'']::public.app_role[]));', t || '_delete_admin', t);
  END LOOP;
END $$;

-- ====================== GROUP C: ads_ai_recommendations ======================
DROP POLICY IF EXISTS "ads_ai_recommendations_select" ON public.ads_ai_recommendations;
DROP POLICY IF EXISTS "ads_ai_recommendations_insert" ON public.ads_ai_recommendations;
DROP POLICY IF EXISTS "ads_ai_recommendations_update" ON public.ads_ai_recommendations;
DROP POLICY IF EXISTS "ads_ai_recommendations_delete" ON public.ads_ai_recommendations;
CREATE POLICY "ads_ai_rec_select_members" ON public.ads_ai_recommendations FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "ads_ai_rec_update_marketing" ON public.ads_ai_recommendations FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff','marketing']::app_role[]));
CREATE POLICY "ads_ai_rec_delete_admin" ON public.ads_ai_recommendations FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- ====================== GROUP D: ad_platform_connections (OAuth) ======================
DROP POLICY IF EXISTS "apc_select_tenant_members" ON public.ad_platform_connections;
DROP POLICY IF EXISTS "apc_insert_tenant_admin" ON public.ad_platform_connections;
DROP POLICY IF EXISTS "apc_update_tenant_admin" ON public.ad_platform_connections;
DROP POLICY IF EXISTS "apc_delete_tenant_admin" ON public.ad_platform_connections;
CREATE POLICY "apc_select_admin" ON public.ad_platform_connections FOR SELECT TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "apc_insert_admin" ON public.ad_platform_connections FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "apc_update_admin" ON public.ad_platform_connections FOR UPDATE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
CREATE POLICY "apc_delete_admin" ON public.ad_platform_connections FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));
