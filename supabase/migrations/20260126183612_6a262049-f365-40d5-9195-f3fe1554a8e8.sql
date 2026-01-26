-- Social Channel Connections table
CREATE TABLE public.social_channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  channel_name TEXT,
  
  -- Credentials (merchant ID, access tokens, etc.)
  credentials JSONB DEFAULT '{}',
  
  -- Feed settings
  feed_url TEXT,
  feed_format TEXT DEFAULT 'xml',
  last_feed_generated_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  products_synced INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_channel_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant's social channel connections"
  ON public.social_channel_connections FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create social channel connections for their tenant"
  ON public.social_channel_connections FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their tenant's social channel connections"
  ON public.social_channel_connections FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their tenant's social channel connections"
  ON public.social_channel_connections FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

-- Add social_channels column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS social_channels JSONB DEFAULT '{}';

-- Index for performance
CREATE INDEX idx_social_channel_connections_tenant ON public.social_channel_connections(tenant_id);
CREATE INDEX idx_social_channel_connections_type ON public.social_channel_connections(channel_type);

-- Trigger for updated_at
CREATE TRIGGER update_social_channel_connections_updated_at
  BEFORE UPDATE ON public.social_channel_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();