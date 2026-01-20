-- Link click tracking table
CREATE TABLE IF NOT EXISTS public.campaign_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  send_id UUID REFERENCES public.campaign_sends(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  link_url TEXT NOT NULL,
  link_text TEXT,
  clicked_at TIMESTAMPTZ DEFAULT now(),
  user_agent TEXT,
  ip_country TEXT
);

-- Add tracking fields to campaign_sends
ALTER TABLE public.campaign_sends 
ADD COLUMN IF NOT EXISTS link_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS ip_country TEXT,
ADD COLUMN IF NOT EXISTS first_opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_clicked_at TIMESTAMPTZ;

-- Indexes for performance (with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_campaign_link_clicks_campaign ON public.campaign_link_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_link_clicks_tenant ON public.campaign_link_clicks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_status ON public.campaign_sends(status);

-- Enable RLS
ALTER TABLE public.campaign_link_clicks ENABLE ROW LEVEL SECURITY;

-- RLS policies for campaign_link_clicks (drop first if exist)
DROP POLICY IF EXISTS "Tenant users can view own link clicks" ON public.campaign_link_clicks;
DROP POLICY IF EXISTS "Service role can insert link clicks" ON public.campaign_link_clicks;

CREATE POLICY "Tenant users can view own link clicks"
ON public.campaign_link_clicks FOR SELECT
USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Service role can insert link clicks"
ON public.campaign_link_clicks FOR INSERT
WITH CHECK (true);