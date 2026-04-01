
-- 1. ads_ai_recommendations
CREATE TABLE public.ads_ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('bolcom', 'amazon', 'google', 'meta')),
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('add_negative_keyword', 'increase_bid', 'decrease_bid', 'pause_campaign', 'pause_keyword', 'resume_campaign', 'budget_increase', 'new_keyword')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('campaign', 'adgroup', 'keyword', 'search_term')),
  entity_id UUID,
  current_value JSONB,
  recommended_value JSONB,
  reason TEXT NOT NULL,
  confidence NUMERIC(3,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'auto_applied')),
  auto_apply BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ads_ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_ai_recommendations_select" ON public.ads_ai_recommendations FOR SELECT TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "ads_ai_recommendations_insert" ON public.ads_ai_recommendations FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "ads_ai_recommendations_update" ON public.ads_ai_recommendations FOR UPDATE TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))) WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "ads_ai_recommendations_delete" ON public.ads_ai_recommendations FOR DELETE TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_ads_ai_recommendations_tenant ON public.ads_ai_recommendations(tenant_id);
CREATE INDEX idx_ads_ai_recommendations_channel ON public.ads_ai_recommendations(channel);
CREATE INDEX idx_ads_ai_recommendations_status ON public.ads_ai_recommendations(status);

-- 2. ads_ai_rules
CREATE TABLE public.ads_ai_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel TEXT CHECK (channel IN ('bolcom', 'amazon', 'google', 'meta')),
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('auto_negative', 'bid_adjustment', 'budget_pacing', 'inventory_pause')),
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ads_ai_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_ai_rules_select" ON public.ads_ai_rules FOR SELECT TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "ads_ai_rules_insert" ON public.ads_ai_rules FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "ads_ai_rules_update" ON public.ads_ai_rules FOR UPDATE TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))) WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "ads_ai_rules_delete" ON public.ads_ai_rules FOR DELETE TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_ads_ai_rules_tenant ON public.ads_ai_rules(tenant_id);
CREATE INDEX idx_ads_ai_rules_channel ON public.ads_ai_rules(channel);

-- 3. ads_product_channel_map
CREATE TABLE public.ads_product_channel_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('bolcom', 'amazon', 'google', 'meta')),
  channel_product_ref TEXT,
  is_advertised BOOLEAN DEFAULT false,
  min_stock_for_ads INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, product_id, channel)
);

ALTER TABLE public.ads_product_channel_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_product_channel_map_select" ON public.ads_product_channel_map FOR SELECT TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "ads_product_channel_map_insert" ON public.ads_product_channel_map FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "ads_product_channel_map_update" ON public.ads_product_channel_map FOR UPDATE TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))) WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "ads_product_channel_map_delete" ON public.ads_product_channel_map FOR DELETE TO authenticated USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_ads_product_channel_map_tenant ON public.ads_product_channel_map(tenant_id);
CREATE INDEX idx_ads_product_channel_map_product ON public.ads_product_channel_map(product_id);
CREATE INDEX idx_ads_product_channel_map_channel ON public.ads_product_channel_map(channel);

-- 4. Global daily summary view
CREATE OR REPLACE VIEW public.ads_global_daily_summary AS
SELECT
  tenant_id,
  date,
  'bolcom'::text AS channel,
  SUM(impressions) AS impressions,
  SUM(clicks) AS clicks,
  SUM(spend) AS spend,
  SUM(orders) AS conversions,
  SUM(revenue) AS revenue,
  CASE WHEN SUM(revenue) > 0 THEN SUM(spend) / SUM(revenue) END AS acos
FROM public.ads_bolcom_performance
GROUP BY tenant_id, date;
