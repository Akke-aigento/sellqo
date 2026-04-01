
-- 1. ads_bolcom_campaigns
CREATE TABLE public.ads_bolcom_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bolcom_campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL DEFAULT 'sponsored_products',
  status TEXT NOT NULL DEFAULT 'paused',
  daily_budget NUMERIC(10,2),
  total_budget NUMERIC(10,2),
  start_date DATE,
  end_date DATE,
  targeting_type TEXT NOT NULL DEFAULT 'automatic',
  raw_data JSONB,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, bolcom_campaign_id)
);

ALTER TABLE public.ads_bolcom_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant bolcom campaigns" ON public.ads_bolcom_campaigns
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can insert their tenant bolcom campaigns" ON public.ads_bolcom_campaigns
  FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can update their tenant bolcom campaigns" ON public.ads_bolcom_campaigns
  FOR UPDATE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can delete their tenant bolcom campaigns" ON public.ads_bolcom_campaigns
  FOR DELETE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_ads_bolcom_campaigns_tenant ON public.ads_bolcom_campaigns(tenant_id);
CREATE INDEX idx_ads_bolcom_campaigns_status ON public.ads_bolcom_campaigns(status);

CREATE TRIGGER update_ads_bolcom_campaigns_updated_at
  BEFORE UPDATE ON public.ads_bolcom_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. ads_bolcom_adgroups
CREATE TABLE public.ads_bolcom_adgroups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ads_bolcom_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bolcom_adgroup_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  default_bid NUMERIC(10,4),
  raw_data JSONB,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, bolcom_adgroup_id)
);

ALTER TABLE public.ads_bolcom_adgroups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant bolcom adgroups" ON public.ads_bolcom_adgroups
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can insert their tenant bolcom adgroups" ON public.ads_bolcom_adgroups
  FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can update their tenant bolcom adgroups" ON public.ads_bolcom_adgroups
  FOR UPDATE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can delete their tenant bolcom adgroups" ON public.ads_bolcom_adgroups
  FOR DELETE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_ads_bolcom_adgroups_tenant ON public.ads_bolcom_adgroups(tenant_id);
CREATE INDEX idx_ads_bolcom_adgroups_campaign ON public.ads_bolcom_adgroups(campaign_id);

-- 3. ads_bolcom_keywords
CREATE TABLE public.ads_bolcom_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adgroup_id UUID NOT NULL REFERENCES public.ads_bolcom_adgroups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bolcom_keyword_id TEXT,
  keyword TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'broad',
  bid NUMERIC(10,4),
  status TEXT NOT NULL DEFAULT 'active',
  is_negative BOOLEAN DEFAULT false,
  raw_data JSONB,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ads_bolcom_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant bolcom keywords" ON public.ads_bolcom_keywords
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can insert their tenant bolcom keywords" ON public.ads_bolcom_keywords
  FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can update their tenant bolcom keywords" ON public.ads_bolcom_keywords
  FOR UPDATE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can delete their tenant bolcom keywords" ON public.ads_bolcom_keywords
  FOR DELETE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_ads_bolcom_keywords_tenant ON public.ads_bolcom_keywords(tenant_id);
CREATE INDEX idx_ads_bolcom_keywords_adgroup ON public.ads_bolcom_keywords(adgroup_id);
CREATE INDEX idx_ads_bolcom_keywords_status ON public.ads_bolcom_keywords(status);

-- 4. ads_bolcom_targeting_products
CREATE TABLE public.ads_bolcom_targeting_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adgroup_id UUID NOT NULL REFERENCES public.ads_bolcom_adgroups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ean TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ads_bolcom_targeting_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant bolcom targeting products" ON public.ads_bolcom_targeting_products
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can insert their tenant bolcom targeting products" ON public.ads_bolcom_targeting_products
  FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can update their tenant bolcom targeting products" ON public.ads_bolcom_targeting_products
  FOR UPDATE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can delete their tenant bolcom targeting products" ON public.ads_bolcom_targeting_products
  FOR DELETE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_ads_bolcom_targeting_products_tenant ON public.ads_bolcom_targeting_products(tenant_id);
CREATE INDEX idx_ads_bolcom_targeting_products_adgroup ON public.ads_bolcom_targeting_products(adgroup_id);

-- 5. ads_bolcom_performance
CREATE TABLE public.ads_bolcom_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.ads_bolcom_campaigns(id) ON DELETE CASCADE,
  adgroup_id UUID REFERENCES public.ads_bolcom_adgroups(id) ON DELETE CASCADE,
  keyword_id UUID REFERENCES public.ads_bolcom_keywords(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend NUMERIC(10,2) DEFAULT 0,
  orders INTEGER DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  acos NUMERIC(6,4),
  ctr NUMERIC(6,4),
  cpc NUMERIC(10,4),
  conversion_rate NUMERIC(6,4),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, campaign_id, adgroup_id, keyword_id, date)
);

ALTER TABLE public.ads_bolcom_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant bolcom performance" ON public.ads_bolcom_performance
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can insert their tenant bolcom performance" ON public.ads_bolcom_performance
  FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can update their tenant bolcom performance" ON public.ads_bolcom_performance
  FOR UPDATE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can delete their tenant bolcom performance" ON public.ads_bolcom_performance
  FOR DELETE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_ads_bolcom_performance_tenant ON public.ads_bolcom_performance(tenant_id);
CREATE INDEX idx_ads_bolcom_performance_campaign ON public.ads_bolcom_performance(campaign_id);
CREATE INDEX idx_ads_bolcom_performance_date ON public.ads_bolcom_performance(date);
CREATE INDEX idx_ads_bolcom_performance_adgroup ON public.ads_bolcom_performance(adgroup_id);

-- 6. ads_bolcom_search_terms
CREATE TABLE public.ads_bolcom_search_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.ads_bolcom_campaigns(id) ON DELETE CASCADE,
  adgroup_id UUID REFERENCES public.ads_bolcom_adgroups(id) ON DELETE CASCADE,
  search_term TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend NUMERIC(10,2) DEFAULT 0,
  orders INTEGER DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  date DATE NOT NULL,
  ai_action TEXT,
  ai_action_taken BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ads_bolcom_search_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant bolcom search terms" ON public.ads_bolcom_search_terms
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can insert their tenant bolcom search terms" ON public.ads_bolcom_search_terms
  FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can update their tenant bolcom search terms" ON public.ads_bolcom_search_terms
  FOR UPDATE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
CREATE POLICY "Users can delete their tenant bolcom search terms" ON public.ads_bolcom_search_terms
  FOR DELETE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_ads_bolcom_search_terms_tenant ON public.ads_bolcom_search_terms(tenant_id);
CREATE INDEX idx_ads_bolcom_search_terms_campaign ON public.ads_bolcom_search_terms(campaign_id);
CREATE INDEX idx_ads_bolcom_search_terms_date ON public.ads_bolcom_search_terms(date);
