-- =====================================================
-- Universal Reviews Hub - Multi-Platform Reviews System
-- =====================================================

-- Table: review_platform_connections
-- Stores credentials and sync status for each review platform per tenant
CREATE TABLE public.review_platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('google', 'trustpilot', 'kiyoh', 'webwinkelkeur', 'trusted_shops', 'facebook')),
  is_enabled BOOLEAN DEFAULT false,
  api_key TEXT,
  api_secret TEXT,
  external_id TEXT,
  external_url TEXT,
  display_name TEXT,
  sync_frequency TEXT DEFAULT 'daily' CHECK (sync_frequency IN ('hourly', 'daily', 'weekly', 'manual')),
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('success', 'failed', 'pending', 'syncing')),
  sync_error TEXT,
  cached_rating DECIMAL(2,1),
  cached_review_count INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, platform)
);

-- Table: external_reviews
-- Cached reviews from all platforms
CREATE TABLE public.external_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  connection_id UUID REFERENCES public.review_platform_connections(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL,
  external_review_id TEXT NOT NULL,
  author_name TEXT,
  author_avatar_url TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  text TEXT,
  reply TEXT,
  reply_date TIMESTAMPTZ,
  review_date TIMESTAMPTZ,
  language TEXT DEFAULT 'nl',
  is_verified BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, platform, external_review_id)
);

-- Add reviews hub settings to tenant_theme_settings
ALTER TABLE public.tenant_theme_settings
ADD COLUMN IF NOT EXISTS reviews_hub_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reviews_display_platforms JSONB DEFAULT '["google", "trustpilot", "kiyoh"]',
ADD COLUMN IF NOT EXISTS reviews_aggregate_display BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reviews_widget_position TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS reviews_floating_style TEXT DEFAULT 'badge',
ADD COLUMN IF NOT EXISTS reviews_min_rating_filter INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS reviews_homepage_section BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reviews_trust_bar_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reviews_auto_feature_threshold INTEGER DEFAULT 5;

-- Enable RLS
ALTER TABLE public.review_platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for review_platform_connections
CREATE POLICY "Users can view their tenant's review connections"
  ON public.review_platform_connections
  FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert their tenant's review connections"
  ON public.review_platform_connections
  FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant's review connections"
  ON public.review_platform_connections
  FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their tenant's review connections"
  ON public.review_platform_connections
  FOR DELETE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- RLS Policies for external_reviews
CREATE POLICY "Users can view their tenant's external reviews"
  ON public.external_reviews
  FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert their tenant's external reviews"
  ON public.external_reviews
  FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant's external reviews"
  ON public.external_reviews
  FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their tenant's external reviews"
  ON public.external_reviews
  FOR DELETE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Public read access for storefront display
CREATE POLICY "Public can view visible reviews"
  ON public.external_reviews
  FOR SELECT
  USING (is_visible = true);

CREATE POLICY "Public can view enabled platform connections"
  ON public.review_platform_connections
  FOR SELECT
  USING (is_enabled = true);

-- Indexes for performance
CREATE INDEX idx_external_reviews_tenant_platform ON public.external_reviews(tenant_id, platform);
CREATE INDEX idx_external_reviews_featured ON public.external_reviews(tenant_id, is_featured) WHERE is_featured = true;
CREATE INDEX idx_external_reviews_visible ON public.external_reviews(tenant_id, is_visible, rating);
CREATE INDEX idx_review_connections_tenant ON public.review_platform_connections(tenant_id);

-- Trigger for updated_at
CREATE TRIGGER update_review_platform_connections_updated_at
  BEFORE UPDATE ON public.review_platform_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_external_reviews_updated_at
  BEFORE UPDATE ON public.external_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();