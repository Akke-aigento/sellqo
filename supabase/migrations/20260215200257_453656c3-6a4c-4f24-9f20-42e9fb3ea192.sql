
-- Create tenant_theme_presets table
CREATE TABLE public.tenant_theme_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  settings JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_theme_presets ENABLE ROW LEVEL SECURITY;

-- RLS policies using existing tenant access pattern
CREATE POLICY "Tenants can view their own presets"
ON public.tenant_theme_presets FOR SELECT
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Tenants can create their own presets"
ON public.tenant_theme_presets FOR INSERT
WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

CREATE POLICY "Tenants can delete their own presets"
ON public.tenant_theme_presets FOR DELETE
USING (tenant_id IN (
  SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
));

-- Index for fast lookups
CREATE INDEX idx_tenant_theme_presets_tenant_id ON public.tenant_theme_presets(tenant_id);
