-- Create oauth_states table for CSRF protection during OAuth flows
CREATE TABLE IF NOT EXISTS public.oauth_states (
  state TEXT PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL,
  redirect_url TEXT NOT NULL,
  code_verifier TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add unique constraint to social_connections for upsert
ALTER TABLE public.social_connections 
DROP CONSTRAINT IF EXISTS social_connections_tenant_platform_unique;

ALTER TABLE public.social_connections 
ADD CONSTRAINT social_connections_tenant_platform_unique 
UNIQUE (tenant_id, platform);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Only service role can access oauth_states (used by edge functions)
CREATE POLICY "Service role only" ON public.oauth_states FOR ALL USING (false);

-- Cleanup old states automatically (run via cron or manual cleanup)
CREATE INDEX idx_oauth_states_expires ON public.oauth_states(expires_at);