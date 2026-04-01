
-- AMAZON
CREATE TABLE public.ads_amazon_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amazon_campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL DEFAULT 'sp',
  status TEXT NOT NULL DEFAULT 'paused',
  daily_budget NUMERIC(10,2),
  targeting_type TEXT NOT NULL DEFAULT 'manual',
  bidding_strategy TEXT,
  raw_data JSONB,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, amazon_campaign_id)
);

CREATE TABLE public.ads_amazon_adgroups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ads_amazon_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amazon_adgroup_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enabled',
  default_bid NUMERIC(10,2),
  raw_data JSONB,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, amazon_adgroup_id)
);

CREATE TABLE public.ads_amazon_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adgroup_id UUID NOT NULL REFERENCES public.ads_amazon_adgroups(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amazon_keyword_id TEXT,
  keyword TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'broad',
  bid NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'enabled',
  is_negative BOOLEAN DEFAULT false,
  raw_data JSONB,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.ads_amazon_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.ads_amazon_campaigns(id) ON DELETE CASCADE,
  adgroup_id UUID REFERENCES public.ads_amazon_adgroups(id) ON DELETE SET NULL,
  keyword_id UUID REFERENCES public.ads_amazon_keywords(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend NUMERIC(10,2) DEFAULT 0,
  orders INTEGER DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  acos NUMERIC(6,2),
  ctr NUMERIC(6,4),
  cpc NUMERIC(10,2),
  conversion_rate NUMERIC(6,4),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, campaign_id, adgroup_id, keyword_id, date)
);

CREATE TABLE public.ads_amazon_search_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.ads_amazon_campaigns(id) ON DELETE CASCADE,
  adgroup_id UUID REFERENCES public.ads_amazon_adgroups(id) ON DELETE SET NULL,
  search_term TEXT NOT NULL,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend NUMERIC(10,2) DEFAULT 0,
  orders INTEGER DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  ai_action TEXT,
  ai_action_taken BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- GOOGLE
CREATE TABLE public.ads_google_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  google_campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL DEFAULT 'search',
  status TEXT NOT NULL DEFAULT 'paused',
  daily_budget NUMERIC(10,2),
  bidding_strategy TEXT,
  raw_data JSONB,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, google_campaign_id)
);

CREATE TABLE public.ads_google_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.ads_google_campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend NUMERIC(10,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  cost_per_conversion NUMERIC(10,2),
  ctr NUMERIC(6,4),
  cpc NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, campaign_id, date)
);

-- META
CREATE TABLE public.ads_meta_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meta_campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT 'conversions',
  status TEXT NOT NULL DEFAULT 'paused',
  daily_budget NUMERIC(10,2),
  lifetime_budget NUMERIC(10,2),
  raw_data JSONB,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, meta_campaign_id)
);

CREATE TABLE public.ads_meta_adsets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ads_meta_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meta_adset_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paused',
  daily_budget NUMERIC(10,2),
  targeting JSONB,
  raw_data JSONB,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, meta_adset_id)
);

CREATE TABLE public.ads_meta_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.ads_meta_campaigns(id) ON DELETE CASCADE,
  adset_id UUID REFERENCES public.ads_meta_adsets(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend NUMERIC(10,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  ctr NUMERIC(6,4),
  cpc NUMERIC(10,2),
  cpm NUMERIC(10,2),
  frequency NUMERIC(6,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, campaign_id, adset_id, date)
);

-- RLS
ALTER TABLE public.ads_amazon_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_amazon_adgroups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_amazon_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_amazon_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_amazon_search_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_google_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_google_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_meta_adsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_meta_performance ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'ads_amazon_campaigns','ads_amazon_adgroups','ads_amazon_keywords','ads_amazon_performance','ads_amazon_search_terms',
    'ads_google_campaigns','ads_google_performance',
    'ads_meta_campaigns','ads_meta_adsets','ads_meta_performance'
  ]) LOOP
    EXECUTE format('CREATE POLICY "tenant_select" ON public.%I FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))', tbl);
    EXECUTE format('CREATE POLICY "tenant_insert" ON public.%I FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))', tbl);
    EXECUTE format('CREATE POLICY "tenant_update" ON public.%I FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))', tbl);
    EXECUTE format('CREATE POLICY "tenant_delete" ON public.%I FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))', tbl);
  END LOOP;
END $$;

-- INDEXES
CREATE INDEX idx_ads_amazon_campaigns_tenant ON public.ads_amazon_campaigns(tenant_id);
CREATE INDEX idx_ads_amazon_campaigns_status ON public.ads_amazon_campaigns(status);
CREATE INDEX idx_ads_amazon_adgroups_tenant ON public.ads_amazon_adgroups(tenant_id);
CREATE INDEX idx_ads_amazon_adgroups_campaign ON public.ads_amazon_adgroups(campaign_id);
CREATE INDEX idx_ads_amazon_keywords_tenant ON public.ads_amazon_keywords(tenant_id);
CREATE INDEX idx_ads_amazon_keywords_adgroup ON public.ads_amazon_keywords(adgroup_id);
CREATE INDEX idx_ads_amazon_perf_tenant ON public.ads_amazon_performance(tenant_id);
CREATE INDEX idx_ads_amazon_perf_date ON public.ads_amazon_performance(date);
CREATE INDEX idx_ads_amazon_perf_campaign ON public.ads_amazon_performance(campaign_id);
CREATE INDEX idx_ads_amazon_st_tenant ON public.ads_amazon_search_terms(tenant_id);
CREATE INDEX idx_ads_amazon_st_date ON public.ads_amazon_search_terms(date);
CREATE INDEX idx_ads_google_campaigns_tenant ON public.ads_google_campaigns(tenant_id);
CREATE INDEX idx_ads_google_campaigns_status ON public.ads_google_campaigns(status);
CREATE INDEX idx_ads_google_perf_tenant ON public.ads_google_performance(tenant_id);
CREATE INDEX idx_ads_google_perf_date ON public.ads_google_performance(date);
CREATE INDEX idx_ads_google_perf_campaign ON public.ads_google_performance(campaign_id);
CREATE INDEX idx_ads_meta_campaigns_tenant ON public.ads_meta_campaigns(tenant_id);
CREATE INDEX idx_ads_meta_campaigns_status ON public.ads_meta_campaigns(status);
CREATE INDEX idx_ads_meta_adsets_tenant ON public.ads_meta_adsets(tenant_id);
CREATE INDEX idx_ads_meta_adsets_campaign ON public.ads_meta_adsets(campaign_id);
CREATE INDEX idx_ads_meta_perf_tenant ON public.ads_meta_performance(tenant_id);
CREATE INDEX idx_ads_meta_perf_date ON public.ads_meta_performance(date);
CREATE INDEX idx_ads_meta_perf_campaign ON public.ads_meta_performance(campaign_id);

-- TRIGGERS
CREATE TRIGGER update_ads_amazon_campaigns_updated_at BEFORE UPDATE ON public.ads_amazon_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ads_google_campaigns_updated_at BEFORE UPDATE ON public.ads_google_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ads_meta_campaigns_updated_at BEFORE UPDATE ON public.ads_meta_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- VIEW: drop first then recreate
DROP VIEW IF EXISTS public.ads_global_daily_summary;

CREATE VIEW public.ads_global_daily_summary AS
SELECT tenant_id, date, 'bolcom' AS channel,
  COALESCE(SUM(impressions), 0) AS impressions,
  COALESCE(SUM(clicks), 0) AS clicks,
  COALESCE(SUM(spend), 0) AS spend,
  COALESCE(SUM(orders), 0) AS orders,
  COALESCE(SUM(revenue), 0) AS revenue,
  CASE WHEN SUM(revenue) > 0 THEN ROUND((SUM(spend) / SUM(revenue))::numeric, 4) END AS acos
FROM public.ads_bolcom_performance GROUP BY tenant_id, date
UNION ALL
SELECT tenant_id, date, 'amazon',
  COALESCE(SUM(impressions), 0), COALESCE(SUM(clicks), 0), COALESCE(SUM(spend), 0),
  COALESCE(SUM(orders), 0), COALESCE(SUM(revenue), 0),
  CASE WHEN SUM(revenue) > 0 THEN ROUND((SUM(spend) / SUM(revenue))::numeric, 4) END
FROM public.ads_amazon_performance GROUP BY tenant_id, date
UNION ALL
SELECT tenant_id, date, 'google',
  COALESCE(SUM(impressions), 0), COALESCE(SUM(clicks), 0), COALESCE(SUM(spend), 0),
  COALESCE(SUM(conversions), 0), COALESCE(SUM(revenue), 0),
  CASE WHEN SUM(revenue) > 0 THEN ROUND((SUM(spend) / SUM(revenue))::numeric, 4) END
FROM public.ads_google_performance GROUP BY tenant_id, date
UNION ALL
SELECT tenant_id, date, 'meta',
  COALESCE(SUM(impressions), 0), COALESCE(SUM(clicks), 0), COALESCE(SUM(spend), 0),
  COALESCE(SUM(conversions), 0), COALESCE(SUM(revenue), 0),
  CASE WHEN SUM(revenue) > 0 THEN ROUND((SUM(spend) / SUM(revenue))::numeric, 4) END
FROM public.ads_meta_performance GROUP BY tenant_id, date;
