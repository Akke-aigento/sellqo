-- Media Assets table for storing all visual assets (uploaded and AI-generated)
CREATE TABLE public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- File info
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  
  -- Metadata
  title TEXT,
  description TEXT,
  alt_text TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- AI context
  ai_description TEXT,
  is_ai_generated BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'upload',
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- Organization
  folder TEXT DEFAULT 'general',
  is_favorite BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_media_assets_tenant ON media_assets(tenant_id);
CREATE INDEX idx_media_assets_folder ON media_assets(tenant_id, folder);
CREATE INDEX idx_media_assets_tags ON media_assets USING GIN(tags);
CREATE INDEX idx_media_assets_is_favorite ON media_assets(tenant_id, is_favorite) WHERE is_favorite = true;

-- Enable RLS
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant's media assets"
ON public.media_assets FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert media assets for their tenant"
ON public.media_assets FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their tenant's media assets"
ON public.media_assets FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their tenant's media assets"
ON public.media_assets FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_media_assets_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for marketing assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketing-assets',
  'marketing-assets', 
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for marketing-assets bucket
CREATE POLICY "Authenticated users can view marketing assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketing-assets');

CREATE POLICY "Users can upload to their tenant folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'marketing-assets' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their tenant's marketing assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'marketing-assets' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their tenant's marketing assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'marketing-assets' AND
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM user_roles WHERE user_id = auth.uid()
  )
);