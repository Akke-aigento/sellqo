-- Create newsletter_subscribers table
CREATE TABLE public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  source TEXT DEFAULT 'website',
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  external_id TEXT,
  sync_status TEXT DEFAULT 'pending',
  sync_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, email)
);

-- Create tenant_newsletter_config table
CREATE TABLE public.tenant_newsletter_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL DEFAULT 'internal',
  
  -- Mailchimp
  mailchimp_api_key TEXT,
  mailchimp_server_prefix TEXT,
  mailchimp_audience_id TEXT,
  
  -- Klaviyo
  klaviyo_api_key TEXT,
  klaviyo_list_id TEXT,
  
  -- General settings
  double_optin BOOLEAN DEFAULT false,
  welcome_email_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_newsletter_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for newsletter_subscribers
CREATE POLICY "Tenant users can view subscribers"
  ON newsletter_subscribers FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant users can insert subscribers"
  ON newsletter_subscribers FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant users can update subscribers"
  ON newsletter_subscribers FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant users can delete subscribers"
  ON newsletter_subscribers FOR DELETE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Allow anonymous inserts for public newsletter signups
CREATE POLICY "Anyone can subscribe to newsletter"
  ON newsletter_subscribers FOR INSERT
  WITH CHECK (true);

-- RLS Policies for tenant_newsletter_config
CREATE POLICY "Tenant users can view config"
  ON tenant_newsletter_config FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant users can insert config"
  ON tenant_newsletter_config FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant users can update config"
  ON tenant_newsletter_config FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Indexes
CREATE INDEX idx_newsletter_subscribers_tenant ON newsletter_subscribers(tenant_id);
CREATE INDEX idx_newsletter_subscribers_email ON newsletter_subscribers(email);
CREATE INDEX idx_newsletter_subscribers_sync ON newsletter_subscribers(tenant_id, sync_status);
CREATE INDEX idx_newsletter_subscribers_status ON newsletter_subscribers(tenant_id, status);

-- Trigger for updated_at
CREATE TRIGGER update_newsletter_subscribers_updated_at
  BEFORE UPDATE ON newsletter_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_newsletter_config_updated_at
  BEFORE UPDATE ON tenant_newsletter_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();