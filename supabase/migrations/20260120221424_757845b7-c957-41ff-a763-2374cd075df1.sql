-- SEO Keywords tracking table
CREATE TABLE public.seo_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  search_volume_estimate TEXT CHECK (search_volume_estimate IN ('high', 'medium', 'low')),
  difficulty_estimate TEXT CHECK (difficulty_estimate IN ('easy', 'medium', 'hard')),
  intent TEXT CHECK (intent IN ('informational', 'commercial', 'transactional', 'navigational')),
  is_primary BOOLEAN DEFAULT false,
  position_tracking JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEO Scores tracking table
CREATE TABLE public.seo_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'category', 'page', 'tenant')),
  entity_id UUID,
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  meta_score INTEGER CHECK (meta_score >= 0 AND meta_score <= 100),
  content_score INTEGER CHECK (content_score >= 0 AND content_score <= 100),
  technical_score INTEGER CHECK (technical_score >= 0 AND technical_score <= 100),
  ai_search_score INTEGER CHECK (ai_search_score >= 0 AND ai_search_score <= 100),
  issues JSONB DEFAULT '[]',
  suggestions JSONB DEFAULT '[]',
  last_analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEO Analysis History for tracking improvements
CREATE TABLE public.seo_analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  score_id UUID REFERENCES public.seo_scores(id) ON DELETE CASCADE,
  overall_score INTEGER,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_seo_keywords_tenant ON public.seo_keywords(tenant_id);
CREATE INDEX idx_seo_keywords_product ON public.seo_keywords(product_id);
CREATE INDEX idx_seo_scores_tenant ON public.seo_scores(tenant_id);
CREATE INDEX idx_seo_scores_entity ON public.seo_scores(entity_type, entity_id);
CREATE INDEX idx_seo_analysis_history_tenant ON public.seo_analysis_history(tenant_id);

-- Enable RLS
ALTER TABLE public.seo_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_analysis_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for seo_keywords
CREATE POLICY "Users can view their tenant's SEO keywords"
ON public.seo_keywords FOR SELECT
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create SEO keywords for their tenant"
ON public.seo_keywords FOR INSERT
WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update their tenant's SEO keywords"
ON public.seo_keywords FOR UPDATE
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete their tenant's SEO keywords"
ON public.seo_keywords FOR DELETE
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

-- RLS Policies for seo_scores
CREATE POLICY "Users can view their tenant's SEO scores"
ON public.seo_scores FOR SELECT
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create SEO scores for their tenant"
ON public.seo_scores FOR INSERT
WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update their tenant's SEO scores"
ON public.seo_scores FOR UPDATE
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete their tenant's SEO scores"
ON public.seo_scores FOR DELETE
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

-- RLS Policies for seo_analysis_history
CREATE POLICY "Users can view their tenant's SEO history"
ON public.seo_analysis_history FOR SELECT
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create SEO history for their tenant"
ON public.seo_analysis_history FOR INSERT
WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

-- Updated_at triggers
CREATE TRIGGER update_seo_keywords_updated_at
BEFORE UPDATE ON public.seo_keywords
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seo_scores_updated_at
BEFORE UPDATE ON public.seo_scores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();