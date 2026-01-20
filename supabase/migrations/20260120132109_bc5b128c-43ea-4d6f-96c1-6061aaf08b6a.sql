-- Create shipping integrations table for storing provider credentials
CREATE TABLE public.shipping_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('sendcloud', 'myparcel', 'shippo', 'easypost', 'manual')),
  display_name TEXT NOT NULL,
  api_key TEXT,
  api_secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  settings JSONB DEFAULT '{}'::jsonb,
  webhook_secret TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

-- Create shipping labels table to track generated labels
CREATE TABLE public.shipping_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.shipping_integrations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  external_id TEXT,
  external_parcel_id TEXT,
  carrier TEXT,
  service_type TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  label_url TEXT,
  label_format TEXT DEFAULT 'pdf',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'created', 'printed', 'shipped', 'delivered', 'cancelled', 'error')),
  error_message TEXT,
  weight_kg NUMERIC(10,3),
  dimensions JSONB,
  shipping_cost NUMERIC(10,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create shipping status updates table for webhook events
CREATE TABLE public.shipping_status_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label_id UUID REFERENCES public.shipping_labels(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_event_id TEXT,
  status TEXT NOT NULL,
  status_message TEXT,
  location TEXT,
  carrier_status TEXT,
  event_timestamp TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shipping_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_status_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shipping_integrations
CREATE POLICY "Users can view their tenant shipping integrations"
  ON public.shipping_integrations FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Tenant admins can manage shipping integrations"
  ON public.shipping_integrations FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- RLS Policies for shipping_labels
CREATE POLICY "Users can view their tenant shipping labels"
  ON public.shipping_labels FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can manage their tenant shipping labels"
  ON public.shipping_labels FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- RLS Policies for shipping_status_updates
CREATE POLICY "Users can view their tenant shipping status updates"
  ON public.shipping_status_updates FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can manage their tenant shipping status updates"
  ON public.shipping_status_updates FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Create trigger to ensure single default integration per tenant
CREATE OR REPLACE FUNCTION public.ensure_single_default_shipping_integration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.shipping_integrations
    SET is_default = false
    WHERE tenant_id = NEW.tenant_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_default_shipping_integration
  BEFORE INSERT OR UPDATE ON public.shipping_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_shipping_integration();

-- Add indexes for performance
CREATE INDEX idx_shipping_integrations_tenant ON public.shipping_integrations(tenant_id);
CREATE INDEX idx_shipping_labels_tenant ON public.shipping_labels(tenant_id);
CREATE INDEX idx_shipping_labels_order ON public.shipping_labels(order_id);
CREATE INDEX idx_shipping_status_updates_label ON public.shipping_status_updates(label_id);
CREATE INDEX idx_shipping_status_updates_order ON public.shipping_status_updates(order_id);