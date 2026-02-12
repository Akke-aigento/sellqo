
-- Create tenant_domains table
CREATE TABLE public.tenant_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'nl',
  is_canonical BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  dns_verified BOOLEAN NOT NULL DEFAULT false,
  verification_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
  ssl_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique domain globally
ALTER TABLE public.tenant_domains ADD CONSTRAINT tenant_domains_domain_unique UNIQUE (domain);

-- Only one canonical per tenant
CREATE UNIQUE INDEX idx_tenant_domains_single_canonical 
  ON public.tenant_domains (tenant_id) 
  WHERE is_canonical = true;

-- Index for lookups
CREATE INDEX idx_tenant_domains_tenant_id ON public.tenant_domains (tenant_id);
CREATE INDEX idx_tenant_domains_domain_lookup ON public.tenant_domains (domain) WHERE is_active = true;

-- Updated_at trigger
CREATE TRIGGER update_tenant_domains_updated_at
  BEFORE UPDATE ON public.tenant_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure single canonical trigger
CREATE OR REPLACE FUNCTION public.ensure_single_canonical_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_canonical = true THEN
    UPDATE public.tenant_domains
    SET is_canonical = false
    WHERE tenant_id = NEW.tenant_id
      AND id != NEW.id
      AND is_canonical = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_ensure_single_canonical_domain
  BEFORE INSERT OR UPDATE ON public.tenant_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_canonical_domain();

-- Enable RLS
ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view domains of their tenant
CREATE POLICY "Users can view own tenant domains"
  ON public.tenant_domains
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    )
  );

-- RLS: Tenant admins can insert domains
CREATE POLICY "Tenant admins can insert domains"
  ON public.tenant_domains
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.tenant_id = tenant_id
        AND ur.role IN ('tenant_admin', 'platform_admin')
    )
  );

-- RLS: Tenant admins can update domains
CREATE POLICY "Tenant admins can update domains"
  ON public.tenant_domains
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.tenant_id = tenant_domains.tenant_id
        AND ur.role IN ('tenant_admin', 'platform_admin')
    )
  );

-- RLS: Tenant admins can delete domains
CREATE POLICY "Tenant admins can delete domains"
  ON public.tenant_domains
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.tenant_id = tenant_domains.tenant_id
        AND ur.role IN ('tenant_admin', 'platform_admin')
    )
  );

-- Public read access for storefront domain lookup (anonymous users need to resolve domains)
CREATE POLICY "Public can read active domains"
  ON public.tenant_domains
  FOR SELECT
  TO anon
  USING (is_active = true AND dns_verified = true);
