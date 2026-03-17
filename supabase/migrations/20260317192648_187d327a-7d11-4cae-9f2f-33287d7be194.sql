
-- Email signatures table
CREATE TABLE public.email_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Standaard',
  body_html TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_signatures ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view signatures for their tenant"
  ON public.email_signatures FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "Users can create signatures for their tenant"
  ON public.email_signatures FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "Users can update signatures for their tenant"
  ON public.email_signatures FOR UPDATE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "Users can delete signatures for their tenant"
  ON public.email_signatures FOR DELETE
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Updated_at trigger
CREATE TRIGGER update_email_signatures_updated_at
  BEFORE UPDATE ON public.email_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
