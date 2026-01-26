-- Unified table for all customer-facing communication triggers
CREATE TABLE public.customer_communication_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Trigger identification
  trigger_type TEXT NOT NULL,  -- 'order_confirmation', 'shipping_update', etc.
  category TEXT NOT NULL,      -- 'orders', 'shipping', 'invoices', 'marketing'
  
  -- Channel toggles
  email_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT false,
  
  -- Template references (nullable, uses defaults if not set)
  email_template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  whatsapp_template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  
  -- Additional settings per trigger
  delay_hours INTEGER DEFAULT 0,  -- For delayed triggers like abandoned cart
  delay_days INTEGER DEFAULT 0,   -- For triggers like review request
  extra_settings JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, trigger_type)
);

-- Enable RLS
ALTER TABLE public.customer_communication_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy for tenant isolation
CREATE POLICY "Tenant members can view their communication settings"
  ON public.customer_communication_settings
  FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can insert their communication settings"
  ON public.customer_communication_settings
  FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can update their communication settings"
  ON public.customer_communication_settings
  FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can delete their communication settings"
  ON public.customer_communication_settings
  FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

-- Indexes for quick lookups
CREATE INDEX idx_customer_comm_tenant ON public.customer_communication_settings(tenant_id);
CREATE INDEX idx_customer_comm_type ON public.customer_communication_settings(trigger_type);
CREATE INDEX idx_customer_comm_category ON public.customer_communication_settings(category);

-- Trigger for updated_at
CREATE TRIGGER update_customer_communication_settings_updated_at
  BEFORE UPDATE ON public.customer_communication_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to initialize default communication settings for a tenant
CREATE OR REPLACE FUNCTION public.initialize_customer_communication_settings(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if no settings exist yet
  IF NOT EXISTS (SELECT 1 FROM customer_communication_settings WHERE tenant_id = p_tenant_id LIMIT 1) THEN
    INSERT INTO customer_communication_settings (tenant_id, trigger_type, category, email_enabled, whatsapp_enabled, delay_hours, delay_days)
    VALUES
      -- Orders
      (p_tenant_id, 'order_confirmation', 'orders', true, false, 0, 0),
      (p_tenant_id, 'payment_received', 'orders', false, false, 0, 0),
      -- Shipping
      (p_tenant_id, 'shipping_update', 'shipping', true, false, 0, 0),
      (p_tenant_id, 'out_for_delivery', 'shipping', false, false, 0, 0),
      (p_tenant_id, 'delivery_confirmation', 'shipping', true, false, 0, 0),
      (p_tenant_id, 'shipping_exception', 'shipping', true, false, 0, 0),
      -- Invoices
      (p_tenant_id, 'invoice_sent', 'invoices', true, false, 0, 0),
      (p_tenant_id, 'payment_reminder', 'invoices', true, false, 0, 0),
      (p_tenant_id, 'quote_sent', 'invoices', true, false, 0, 0),
      -- Marketing
      (p_tenant_id, 'abandoned_cart', 'marketing', false, false, 1, 0),
      (p_tenant_id, 'review_request', 'marketing', true, false, 0, 7);
  END IF;
END;
$$;

-- Migrate existing settings from tenants table to the new unified table
-- This will run for all existing tenants
INSERT INTO public.customer_communication_settings (tenant_id, trigger_type, category, email_enabled, whatsapp_enabled, delay_hours)
SELECT 
  t.id,
  'order_confirmation',
  'orders',
  true,
  COALESCE(t.whatsapp_order_confirmation, false),
  0
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.customer_communication_settings 
  WHERE tenant_id = t.id AND trigger_type = 'order_confirmation'
)
ON CONFLICT (tenant_id, trigger_type) DO NOTHING;

INSERT INTO public.customer_communication_settings (tenant_id, trigger_type, category, email_enabled, whatsapp_enabled, delay_hours)
SELECT 
  t.id,
  'shipping_update',
  'shipping',
  true,
  COALESCE(t.whatsapp_shipping_updates, false),
  0
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.customer_communication_settings 
  WHERE tenant_id = t.id AND trigger_type = 'shipping_update'
)
ON CONFLICT (tenant_id, trigger_type) DO NOTHING;

INSERT INTO public.customer_communication_settings (tenant_id, trigger_type, category, email_enabled, whatsapp_enabled, delay_hours)
SELECT 
  t.id,
  'abandoned_cart',
  'marketing',
  false,
  COALESCE(t.whatsapp_abandoned_cart, false),
  COALESCE(t.whatsapp_abandoned_cart_delay_hours, 1)
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.customer_communication_settings 
  WHERE tenant_id = t.id AND trigger_type = 'abandoned_cart'
)
ON CONFLICT (tenant_id, trigger_type) DO NOTHING;

INSERT INTO public.customer_communication_settings (tenant_id, trigger_type, category, email_enabled, whatsapp_enabled, delay_hours)
SELECT 
  t.id,
  'invoice_sent',
  'invoices',
  COALESCE(t.auto_send_invoice_email, false),
  false,
  0
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.customer_communication_settings 
  WHERE tenant_id = t.id AND trigger_type = 'invoice_sent'
)
ON CONFLICT (tenant_id, trigger_type) DO NOTHING;