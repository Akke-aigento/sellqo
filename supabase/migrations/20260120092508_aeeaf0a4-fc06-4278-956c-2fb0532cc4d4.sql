-- Email templates die tenants kunnen hergebruiken
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  json_content JSONB,
  category TEXT DEFAULT 'general',
  thumbnail_url TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Klantsegmenten voor targeting
CREATE TABLE public.customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filter_rules JSONB NOT NULL DEFAULT '{}',
  is_dynamic BOOLEAN DEFAULT true,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Statische segment membership
CREATE TABLE public.segment_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES public.customer_segments(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(segment_id, customer_id)
);

-- Email campagnes
CREATE TABLE public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  html_content TEXT NOT NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  segment_id UUID REFERENCES public.customer_segments(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_unsubscribed INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individuele email verzendingen per campagne
CREATE TABLE public.campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  customer_name TEXT,
  status TEXT DEFAULT 'pending',
  resend_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unsubscribe tracking per tenant
CREATE TABLE public.email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  reason TEXT,
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  unsubscribed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- Automation flows
CREATE TABLE public.email_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  delay_hours INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  total_sent INTEGER DEFAULT 0,
  total_converted INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Voeg email marketing velden toe aan customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email_subscribed BOOLEAN DEFAULT true;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email_subscribed_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_email_opened_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email_engagement_score INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segment_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_templates
CREATE POLICY "Users can view templates for their tenants" ON public.email_templates
  FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert templates for their tenants" ON public.email_templates
  FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update templates for their tenants" ON public.email_templates
  FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete templates for their tenants" ON public.email_templates
  FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- RLS Policies for customer_segments
CREATE POLICY "Users can view segments for their tenants" ON public.customer_segments
  FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert segments for their tenants" ON public.customer_segments
  FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update segments for their tenants" ON public.customer_segments
  FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete segments for their tenants" ON public.customer_segments
  FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- RLS Policies for segment_members
CREATE POLICY "Users can view segment members for their tenants" ON public.segment_members
  FOR SELECT USING (segment_id IN (
    SELECT id FROM public.customer_segments WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Users can insert segment members for their tenants" ON public.segment_members
  FOR INSERT WITH CHECK (segment_id IN (
    SELECT id FROM public.customer_segments WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Users can delete segment members for their tenants" ON public.segment_members
  FOR DELETE USING (segment_id IN (
    SELECT id FROM public.customer_segments WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

-- RLS Policies for email_campaigns
CREATE POLICY "Users can view campaigns for their tenants" ON public.email_campaigns
  FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert campaigns for their tenants" ON public.email_campaigns
  FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update campaigns for their tenants" ON public.email_campaigns
  FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete campaigns for their tenants" ON public.email_campaigns
  FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- RLS Policies for campaign_sends
CREATE POLICY "Users can view campaign sends for their tenants" ON public.campaign_sends
  FOR SELECT USING (campaign_id IN (
    SELECT id FROM public.email_campaigns WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Users can insert campaign sends for their tenants" ON public.campaign_sends
  FOR INSERT WITH CHECK (campaign_id IN (
    SELECT id FROM public.email_campaigns WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

CREATE POLICY "Users can update campaign sends for their tenants" ON public.campaign_sends
  FOR UPDATE USING (campaign_id IN (
    SELECT id FROM public.email_campaigns WHERE tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  ));

-- RLS Policies for email_unsubscribes
CREATE POLICY "Users can view unsubscribes for their tenants" ON public.email_unsubscribes
  FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert unsubscribes for their tenants" ON public.email_unsubscribes
  FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- RLS Policies for email_automations
CREATE POLICY "Users can view automations for their tenants" ON public.email_automations
  FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert automations for their tenants" ON public.email_automations
  FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update automations for their tenants" ON public.email_automations
  FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete automations for their tenants" ON public.email_automations
  FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

-- Indexes for performance
CREATE INDEX idx_email_templates_tenant ON public.email_templates(tenant_id);
CREATE INDEX idx_customer_segments_tenant ON public.customer_segments(tenant_id);
CREATE INDEX idx_email_campaigns_tenant ON public.email_campaigns(tenant_id);
CREATE INDEX idx_email_campaigns_status ON public.email_campaigns(status);
CREATE INDEX idx_campaign_sends_campaign ON public.campaign_sends(campaign_id);
CREATE INDEX idx_campaign_sends_status ON public.campaign_sends(status);
CREATE INDEX idx_email_unsubscribes_tenant_email ON public.email_unsubscribes(tenant_id, email);
CREATE INDEX idx_customers_email_subscribed ON public.customers(tenant_id, email_subscribed);