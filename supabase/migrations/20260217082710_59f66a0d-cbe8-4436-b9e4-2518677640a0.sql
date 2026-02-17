
-- Create table for per-tenant OAuth credentials
CREATE TABLE public.tenant_oauth_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, platform)
);

-- Enable RLS
ALTER TABLE public.tenant_oauth_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies: tenant members can read their own credentials
CREATE POLICY "Tenant members can view own credentials"
  ON public.tenant_oauth_credentials
  FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  ));

-- Only tenant admins can insert/update/delete credentials
CREATE POLICY "Tenant admins can manage credentials"
  ON public.tenant_oauth_credentials
  FOR ALL
  TO authenticated
  USING (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('tenant_admin', 'platform_admin')
  ))
  WITH CHECK (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('tenant_admin', 'platform_admin')
  ));

-- Trigger for updated_at
CREATE TRIGGER update_tenant_oauth_credentials_updated_at
  BEFORE UPDATE ON public.tenant_oauth_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
