
-- Add custom_frontend_config JSONB column to tenant_theme_settings
ALTER TABLE public.tenant_theme_settings 
ADD COLUMN IF NOT EXISTS custom_frontend_config JSONB DEFAULT '{}';

-- Storefront API Keys table (per tenant)
CREATE TABLE IF NOT EXISTS public.storefront_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT DEFAULT 'Storefront API Key',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Webhook configuration (per tenant)
CREATE TABLE IF NOT EXISTS public.storefront_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] DEFAULT '{}',
  secret TEXT,
  is_active BOOLEAN DEFAULT true,
  last_delivery_at TIMESTAMPTZ,
  last_delivery_status INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook delivery log
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.storefront_webhooks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_storefront_api_keys_tenant ON public.storefront_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_storefront_webhooks_tenant ON public.storefront_webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_tenant ON public.webhook_deliveries(tenant_id);

-- RLS
ALTER TABLE public.storefront_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS policies for storefront_api_keys (tenant members can manage)
CREATE POLICY "Tenant members can view API keys"
  ON public.storefront_api_keys FOR SELECT
  USING (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  ));

CREATE POLICY "Tenant admins can insert API keys"
  ON public.storefront_api_keys FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('platform_admin', 'tenant_admin')
  ));

CREATE POLICY "Tenant admins can update API keys"
  ON public.storefront_api_keys FOR UPDATE
  USING (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('platform_admin', 'tenant_admin')
  ));

CREATE POLICY "Tenant admins can delete API keys"
  ON public.storefront_api_keys FOR DELETE
  USING (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('platform_admin', 'tenant_admin')
  ));

-- RLS policies for storefront_webhooks
CREATE POLICY "Tenant members can view webhooks"
  ON public.storefront_webhooks FOR SELECT
  USING (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  ));

CREATE POLICY "Tenant admins can manage webhooks"
  ON public.storefront_webhooks FOR ALL
  USING (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('platform_admin', 'tenant_admin')
  ));

-- RLS policies for webhook_deliveries
CREATE POLICY "Tenant members can view deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  ));

CREATE POLICY "System can insert deliveries"
  ON public.webhook_deliveries FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('platform_admin', 'tenant_admin')
  ));
