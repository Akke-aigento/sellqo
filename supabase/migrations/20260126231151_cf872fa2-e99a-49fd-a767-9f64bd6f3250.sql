-- Ad Platform Connections (OAuth tokens per merchant)
CREATE TABLE public.ad_platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,  -- 'google_ads', 'meta_ads', 'bol_ads', 'amazon_ads'
  
  -- Account info
  account_id TEXT,
  account_name TEXT,
  currency TEXT DEFAULT 'EUR',
  
  -- OAuth tokens (encrypted in practice)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Platform-specific config
  config JSONB DEFAULT '{}',
  
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, platform)
);

-- Ad Campaigns (unified across platforms)
CREATE TABLE public.ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.ad_platform_connections(id) ON DELETE SET NULL,
  
  -- Basic info
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  campaign_type TEXT NOT NULL,
  
  -- Targeting
  segment_id UUID REFERENCES public.customer_segments(id) ON DELETE SET NULL,
  audience_type TEXT,
  audience_config JSONB DEFAULT '{}',
  
  product_ids UUID[],
  category_ids UUID[],
  
  -- Budget
  budget_type TEXT DEFAULT 'daily',
  budget_amount DECIMAL(10,2),
  bid_strategy TEXT DEFAULT 'auto',
  target_roas DECIMAL(5,2),
  
  -- Schedule
  status TEXT DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  
  -- Platform reference
  platform_campaign_id TEXT,
  platform_status TEXT,
  
  -- Performance (synced from platform)
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  roas DECIMAL(5,2),
  
  -- AI-generated
  ai_suggested BOOLEAN DEFAULT false,
  ai_suggestion_id UUID REFERENCES public.ai_action_suggestions(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ad Creatives (images, copy per campaign)
CREATE TABLE public.ad_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  creative_type TEXT NOT NULL,
  headline TEXT,
  description TEXT,
  call_to_action TEXT,
  
  image_urls TEXT[],
  video_url TEXT,
  
  platform_creative_id TEXT,
  status TEXT DEFAULT 'draft',
  
  variant_label TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audience Sync Log
CREATE TABLE public.ad_audience_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.ad_platform_connections(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.customer_segments(id) ON DELETE SET NULL,
  
  platform TEXT NOT NULL,
  platform_audience_id TEXT,
  audience_name TEXT,
  audience_size INTEGER,
  
  sync_type TEXT,
  sync_status TEXT DEFAULT 'pending',
  error_message TEXT,
  
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ad_platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_audience_syncs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ad_platform_connections
CREATE POLICY "Tenant users can view their ad connections"
  ON public.ad_platform_connections FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can manage ad connections"
  ON public.ad_platform_connections FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('tenant_admin', 'platform_admin')))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('tenant_admin', 'platform_admin')));

-- RLS Policies for ad_campaigns
CREATE POLICY "Tenant users can view their campaigns"
  ON public.ad_campaigns FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can manage campaigns"
  ON public.ad_campaigns FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('tenant_admin', 'platform_admin', 'staff')))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('tenant_admin', 'platform_admin', 'staff')));

-- RLS Policies for ad_creatives
CREATE POLICY "Tenant users can view their creatives"
  ON public.ad_creatives FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can manage creatives"
  ON public.ad_creatives FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('tenant_admin', 'platform_admin', 'staff')))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('tenant_admin', 'platform_admin', 'staff')));

-- RLS Policies for ad_audience_syncs
CREATE POLICY "Tenant users can view their audience syncs"
  ON public.ad_audience_syncs FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant admins can manage audience syncs"
  ON public.ad_audience_syncs FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('tenant_admin', 'platform_admin', 'staff')))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('tenant_admin', 'platform_admin', 'staff')));

-- Indexes for performance
CREATE INDEX idx_ad_platform_connections_tenant ON public.ad_platform_connections(tenant_id);
CREATE INDEX idx_ad_campaigns_tenant ON public.ad_campaigns(tenant_id);
CREATE INDEX idx_ad_campaigns_platform ON public.ad_campaigns(platform);
CREATE INDEX idx_ad_campaigns_status ON public.ad_campaigns(status);
CREATE INDEX idx_ad_creatives_campaign ON public.ad_creatives(campaign_id);
CREATE INDEX idx_ad_audience_syncs_tenant ON public.ad_audience_syncs(tenant_id);

-- Trigger for updated_at
CREATE TRIGGER update_ad_platform_connections_updated_at
  BEFORE UPDATE ON public.ad_platform_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ad_campaigns_updated_at
  BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();