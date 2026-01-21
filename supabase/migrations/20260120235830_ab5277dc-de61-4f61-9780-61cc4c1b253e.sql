-- SEO Competitors table for competitor analysis
CREATE TABLE public.seo_competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  tracked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- SEO Competitor keyword positions
CREATE TABLE public.seo_competitor_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES public.seo_competitors(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  our_position INTEGER,
  competitor_position INTEGER,
  search_volume INTEGER,
  difficulty_score INTEGER,
  tracked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Core Web Vitals history
CREATE TABLE public.seo_web_vitals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  lcp_value NUMERIC,
  fid_value NUMERIC,
  cls_value NUMERIC,
  ttfb_value NUMERIC,
  inp_value NUMERIC,
  performance_score INTEGER,
  measured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  device_type TEXT DEFAULT 'desktop',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Scheduled SEO audits
CREATE TABLE public.seo_scheduled_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  audit_type TEXT NOT NULL DEFAULT 'full',
  frequency TEXT NOT NULL DEFAULT 'weekly',
  next_run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_run_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  notify_on_issues BOOLEAN DEFAULT true,
  notify_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- SEO audit results history
CREATE TABLE public.seo_audit_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scheduled_audit_id UUID REFERENCES public.seo_scheduled_audits(id) ON DELETE SET NULL,
  audit_type TEXT NOT NULL,
  overall_score INTEGER,
  issues_found INTEGER DEFAULT 0,
  issues_fixed INTEGER DEFAULT 0,
  results JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'running',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Search Console data (simulated/cached)
CREATE TABLE public.seo_search_console_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  page TEXT,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr NUMERIC,
  position NUMERIC,
  date DATE NOT NULL,
  country TEXT,
  device TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seo_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_competitor_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_web_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_scheduled_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_audit_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_search_console_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for seo_competitors
CREATE POLICY "Users can view their tenant's competitors" ON public.seo_competitors
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their tenant's competitors" ON public.seo_competitors
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their tenant's competitors" ON public.seo_competitors
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their tenant's competitors" ON public.seo_competitors
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for seo_competitor_keywords
CREATE POLICY "Users can view their tenant's competitor keywords" ON public.seo_competitor_keywords
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their tenant's competitor keywords" ON public.seo_competitor_keywords
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their tenant's competitor keywords" ON public.seo_competitor_keywords
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their tenant's competitor keywords" ON public.seo_competitor_keywords
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for seo_web_vitals
CREATE POLICY "Users can view their tenant's web vitals" ON public.seo_web_vitals
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their tenant's web vitals" ON public.seo_web_vitals
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for seo_scheduled_audits
CREATE POLICY "Users can view their tenant's scheduled audits" ON public.seo_scheduled_audits
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their tenant's scheduled audits" ON public.seo_scheduled_audits
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their tenant's scheduled audits" ON public.seo_scheduled_audits
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their tenant's scheduled audits" ON public.seo_scheduled_audits
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for seo_audit_results
CREATE POLICY "Users can view their tenant's audit results" ON public.seo_audit_results
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their tenant's audit results" ON public.seo_audit_results
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- RLS Policies for seo_search_console_data
CREATE POLICY "Users can view their tenant's search console data" ON public.seo_search_console_data
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their tenant's search console data" ON public.seo_search_console_data
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Indexes for performance
CREATE INDEX idx_seo_competitors_tenant ON public.seo_competitors(tenant_id);
CREATE INDEX idx_seo_competitor_keywords_tenant ON public.seo_competitor_keywords(tenant_id);
CREATE INDEX idx_seo_competitor_keywords_competitor ON public.seo_competitor_keywords(competitor_id);
CREATE INDEX idx_seo_web_vitals_tenant ON public.seo_web_vitals(tenant_id);
CREATE INDEX idx_seo_web_vitals_measured ON public.seo_web_vitals(measured_at);
CREATE INDEX idx_seo_scheduled_audits_tenant ON public.seo_scheduled_audits(tenant_id);
CREATE INDEX idx_seo_scheduled_audits_next_run ON public.seo_scheduled_audits(next_run_at);
CREATE INDEX idx_seo_audit_results_tenant ON public.seo_audit_results(tenant_id);
CREATE INDEX idx_seo_search_console_tenant ON public.seo_search_console_data(tenant_id);
CREATE INDEX idx_seo_search_console_date ON public.seo_search_console_data(date);