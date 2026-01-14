-- Create shipping_methods table
CREATE TABLE public.shipping_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  free_above NUMERIC, -- Gratis verzending boven dit bedrag
  estimated_days_min INTEGER DEFAULT 1,
  estimated_days_max INTEGER DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_shipping_methods_tenant ON public.shipping_methods(tenant_id);
CREATE INDEX idx_shipping_methods_active ON public.shipping_methods(tenant_id, is_active);

-- Add shipping tracking fields to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS shipping_method_id UUID REFERENCES public.shipping_methods(id),
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS tracking_url TEXT,
ADD COLUMN IF NOT EXISTS carrier TEXT;

-- Enable RLS
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shipping_methods
CREATE POLICY "Platform admins can view all shipping methods"
ON public.shipping_methods FOR SELECT
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view their tenant's shipping methods"
ON public.shipping_methods FOR SELECT
USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY "Platform admins can insert any shipping method"
ON public.shipping_methods FOR INSERT
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Users can insert shipping methods for their tenant"
ON public.shipping_methods FOR INSERT
WITH CHECK (
  tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Platform admins can update any shipping method"
ON public.shipping_methods FOR UPDATE
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can update their tenant's shipping methods"
ON public.shipping_methods FOR UPDATE
USING (
  tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Platform admins can delete any shipping method"
ON public.shipping_methods FOR DELETE
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can delete their tenant's shipping methods"
ON public.shipping_methods FOR DELETE
USING (
  tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
  AND has_role(auth.uid(), 'tenant_admin')
);

-- Trigger for updated_at
CREATE TRIGGER update_shipping_methods_updated_at
  BEFORE UPDATE ON public.shipping_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Function to ensure only one default shipping method per tenant
CREATE OR REPLACE FUNCTION public.ensure_single_default_shipping()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.shipping_methods
    SET is_default = false
    WHERE tenant_id = NEW.tenant_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER ensure_single_default_shipping_trigger
  BEFORE INSERT OR UPDATE ON public.shipping_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_shipping();