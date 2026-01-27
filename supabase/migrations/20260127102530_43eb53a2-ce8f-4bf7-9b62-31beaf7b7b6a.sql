-- Create tenant_addons table for tracking purchased add-ons
CREATE TABLE public.tenant_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  addon_type text NOT NULL, -- 'peppol', 'pos', 'whatsapp', 'webshop', 'bol_com', etc.
  status text DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'pending')),
  stripe_subscription_id text,
  stripe_price_id text,
  price_monthly numeric(10,2),
  activated_at timestamptz DEFAULT now(),
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, addon_type)
);

-- Enable RLS
ALTER TABLE public.tenant_addons ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Tenants can only see their own add-ons
CREATE POLICY "Tenants can view their own addons"
  ON public.tenant_addons
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all addons"
  ON public.tenant_addons
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Index for performance
CREATE INDEX idx_tenant_addons_tenant_id ON public.tenant_addons(tenant_id);
CREATE INDEX idx_tenant_addons_status ON public.tenant_addons(status);
CREATE INDEX idx_tenant_addons_type ON public.tenant_addons(addon_type);

-- Trigger for updated_at
CREATE TRIGGER update_tenant_addons_updated_at
  BEFORE UPDATE ON public.tenant_addons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function to check if tenant has an active addon
CREATE OR REPLACE FUNCTION public.has_addon(_tenant_id uuid, _addon_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_addons
    WHERE tenant_id = _tenant_id
      AND addon_type = _addon_type
      AND status = 'active'
  )
$$;