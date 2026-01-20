-- ===========================================
-- AI MARKETING HUB - COMPLETE FEATURE EXPANSION
-- ===========================================

-- 1. MULTI-LANGUAGE SUPPORT
-- Add language column to ai_generated_content
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'nl';

-- 2. SCHEDULED PUBLISHING
-- Add publishing status columns
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS publish_status TEXT DEFAULT 'draft';
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.ai_generated_content ADD COLUMN IF NOT EXISTS publish_error TEXT;

-- 3. A/B TESTING FOR EMAIL CAMPAIGNS
-- Extend email_campaigns table
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS ab_variant_of UUID REFERENCES public.email_campaigns(id);
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS variant_label TEXT;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS is_ab_test BOOLEAN DEFAULT false;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS ab_test_winner_selected_at TIMESTAMPTZ;

-- A/B Test configurations table
CREATE TABLE IF NOT EXISTS public.ab_test_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_a_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  campaign_b_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  test_metric TEXT DEFAULT 'open_rate',
  test_percentage INTEGER DEFAULT 20,
  winner_threshold NUMERIC DEFAULT 0.95,
  auto_select_winner BOOLEAN DEFAULT true,
  winner_id UUID REFERENCES public.email_campaigns(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ab_test_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies for ab_test_configs
CREATE POLICY "Users can view their tenant ab_test_configs" ON public.ab_test_configs
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert their tenant ab_test_configs" ON public.ab_test_configs
  FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant ab_test_configs" ON public.ab_test_configs
  FOR UPDATE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their tenant ab_test_configs" ON public.ab_test_configs
  FOR DELETE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 4. TEMPLATE FAVORITES (Prompt Library)
CREATE TABLE IF NOT EXISTS public.ai_prompt_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt_type TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_prompt_favorites ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_prompt_favorites
CREATE POLICY "Users can view their tenant prompt favorites" ON public.ai_prompt_favorites
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert prompt favorites" ON public.ai_prompt_favorites
  FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant prompt favorites" ON public.ai_prompt_favorites
  FOR UPDATE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their tenant prompt favorites" ON public.ai_prompt_favorites
  FOR DELETE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 5. SOCIAL MEDIA CONNECTIONS
CREATE TABLE IF NOT EXISTS public.social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  account_id TEXT,
  account_name TEXT,
  account_avatar TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies for social_connections
CREATE POLICY "Users can view their tenant social connections" ON public.social_connections
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert social connections" ON public.social_connections
  FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant social connections" ON public.social_connections
  FOR UPDATE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their tenant social connections" ON public.social_connections
  FOR DELETE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 6. SOCIAL POSTS
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.social_connections(id) ON DELETE SET NULL,
  content_id UUID REFERENCES public.ai_generated_content(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  post_text TEXT NOT NULL,
  image_urls TEXT[],
  scheduled_for TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  platform_post_id TEXT,
  status TEXT DEFAULT 'draft',
  error_message TEXT,
  engagement_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

-- RLS policies for social_posts
CREATE POLICY "Users can view their tenant social posts" ON public.social_posts
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert social posts" ON public.social_posts
  FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their tenant social posts" ON public.social_posts
  FOR UPDATE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their tenant social posts" ON public.social_posts
  FOR DELETE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 7. AI IMAGES TABLE (for tracking generated images)
CREATE TABLE IF NOT EXISTS public.ai_generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  storage_path TEXT,
  width INTEGER,
  height INTEGER,
  style TEXT,
  credits_used INTEGER DEFAULT 5,
  content_id UUID REFERENCES public.ai_generated_content(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_generated_images ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_generated_images
CREATE POLICY "Users can view their tenant ai images" ON public.ai_generated_images
  FOR SELECT USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert ai images" ON public.ai_generated_images
  FOR INSERT WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their tenant ai images" ON public.ai_generated_images
  FOR DELETE USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 8. ENGAGEMENT ANALYTICS VIEW
CREATE OR REPLACE VIEW public.ai_content_engagement_stats AS
SELECT 
  ac.id,
  ac.tenant_id,
  ac.content_type,
  ac.platform,
  ac.title,
  ac.language,
  ac.created_at,
  ac.is_used,
  ac.used_at,
  ac.publish_status,
  ac.published_at,
  sp.id as social_post_id,
  sp.status as social_status,
  sp.engagement_data,
  COALESCE((sp.engagement_data->>'likes')::integer, 0) as likes,
  COALESCE((sp.engagement_data->>'comments')::integer, 0) as comments,
  COALESCE((sp.engagement_data->>'shares')::integer, 0) as shares,
  COALESCE((sp.engagement_data->>'impressions')::integer, 0) as impressions
FROM public.ai_generated_content ac
LEFT JOIN public.social_posts sp ON sp.content_id = ac.id;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_prompt_favorites_tenant ON public.ai_prompt_favorites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_favorites_type ON public.ai_prompt_favorites(prompt_type);
CREATE INDEX IF NOT EXISTS idx_social_connections_tenant ON public.social_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_platform ON public.social_connections(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_tenant ON public.social_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON public.social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON public.social_posts(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_ai_generated_images_tenant ON public.ai_generated_images(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_configs_tenant ON public.ab_test_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_content_language ON public.ai_generated_content(language);
CREATE INDEX IF NOT EXISTS idx_ai_generated_content_publish_status ON public.ai_generated_content(publish_status);