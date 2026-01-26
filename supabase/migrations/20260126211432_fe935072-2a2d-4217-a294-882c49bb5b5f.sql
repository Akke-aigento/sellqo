
-- WhatsApp Business Account connecties per tenant
CREATE TABLE public.whatsapp_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  business_account_id TEXT NOT NULL,
  display_phone_number TEXT NOT NULL,
  verified_name TEXT,
  access_token_encrypted TEXT NOT NULL,
  webhook_verify_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  is_active BOOLEAN NOT NULL DEFAULT true,
  quality_rating TEXT,
  messaging_limit TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Message templates (goedgekeurd door Meta)
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN (
    'order_confirmation', 'shipping_update', 'delivery_confirmation',
    'abandoned_cart', 'payment_reminder', 'review_request', 'custom'
  )),
  language TEXT NOT NULL DEFAULT 'nl',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  meta_template_id TEXT,
  header_text TEXT,
  body_text TEXT NOT NULL,
  footer_text TEXT,
  buttons JSONB DEFAULT '[]',
  variables JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WhatsApp preferences per klant
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_in BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_in_at TIMESTAMPTZ;

-- Extend customer_messages voor WhatsApp
ALTER TABLE public.customer_messages
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_status TEXT;

-- Add constraint for channel after adding column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_messages_channel_check'
  ) THEN
    ALTER TABLE public.customer_messages 
      ADD CONSTRAINT customer_messages_channel_check 
      CHECK (channel IN ('email', 'whatsapp', 'sms'));
  END IF;
END $$;

-- Add constraint for whatsapp_status after adding column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_messages_whatsapp_status_check'
  ) THEN
    ALTER TABLE public.customer_messages 
      ADD CONSTRAINT customer_messages_whatsapp_status_check 
      CHECK (whatsapp_status IS NULL OR whatsapp_status IN ('sent', 'delivered', 'read', 'failed'));
  END IF;
END $$;

-- WhatsApp tenant settings
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_order_confirmation BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_shipping_updates BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_abandoned_cart BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_abandoned_cart_delay_hours INTEGER DEFAULT 1;

-- Enable RLS on new tables
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_connections
CREATE POLICY "Users can view their tenant whatsapp connections"
  ON public.whatsapp_connections
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can manage whatsapp connections"
  ON public.whatsapp_connections
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('tenant_admin', 'platform_admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('tenant_admin', 'platform_admin')
    )
  );

-- RLS policies for whatsapp_templates
CREATE POLICY "Users can view their tenant whatsapp templates"
  ON public.whatsapp_templates
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can manage whatsapp templates"
  ON public.whatsapp_templates
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('tenant_admin', 'platform_admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('tenant_admin', 'platform_admin')
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_tenant ON public.whatsapp_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_tenant ON public.whatsapp_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_type ON public.whatsapp_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_customer_messages_channel ON public.customer_messages(channel);
CREATE INDEX IF NOT EXISTS idx_customers_whatsapp ON public.customers(whatsapp_number) WHERE whatsapp_opted_in = true;
