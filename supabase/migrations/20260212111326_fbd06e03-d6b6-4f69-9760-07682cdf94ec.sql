
-- =============================================
-- Tabel 1: product_specifications (gestructureerde velden)
-- =============================================
CREATE TABLE public.product_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Afmetingen & Gewicht
  length_cm NUMERIC,
  width_cm NUMERIC,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  package_length_cm NUMERIC,
  package_width_cm NUMERIC,
  package_height_cm NUMERIC,
  package_weight_kg NUMERIC,
  units_per_package INTEGER,
  -- Identificatie
  upc TEXT,
  mpn TEXT,
  isbn TEXT,
  brand TEXT,
  manufacturer TEXT,
  model_number TEXT,
  country_of_origin TEXT,
  hs_tariff_code TEXT,
  -- Materiaal
  material TEXT,
  color TEXT,
  size TEXT,
  composition JSONB,
  -- Garantie & Compliance
  warranty_months INTEGER,
  ce_marking BOOLEAN DEFAULT false,
  energy_label TEXT,
  safety_warnings TEXT,
  -- Logistiek
  lead_time_days INTEGER,
  shipping_class TEXT,
  is_fragile BOOLEAN DEFAULT false,
  is_hazardous BOOLEAN DEFAULT false,
  hazard_class TEXT,
  storage_instructions TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

ALTER TABLE public.product_specifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view own specs" ON public.product_specifications
  FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant users can insert own specs" ON public.product_specifications
  FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant users can update own specs" ON public.product_specifications
  FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant users can delete own specs" ON public.product_specifications
  FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TRIGGER update_product_specifications_updated_at
  BEFORE UPDATE ON public.product_specifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_product_specifications_product_id ON public.product_specifications(product_id);
CREATE INDEX idx_product_specifications_tenant_id ON public.product_specifications(tenant_id);

-- =============================================
-- Tabel 2: product_custom_specs (vrije key-value paren)
-- =============================================
CREATE TABLE public.product_custom_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL DEFAULT 'Algemeen',
  spec_key TEXT NOT NULL,
  spec_value TEXT,
  value_type TEXT NOT NULL DEFAULT 'text',
  sort_order INTEGER NOT NULL DEFAULT 0,
  group_sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_custom_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view own custom specs" ON public.product_custom_specs
  FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant users can insert own custom specs" ON public.product_custom_specs
  FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant users can update own custom specs" ON public.product_custom_specs
  FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant users can delete own custom specs" ON public.product_custom_specs
  FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE TRIGGER update_product_custom_specs_updated_at
  BEFORE UPDATE ON public.product_custom_specs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_product_custom_specs_product_id ON public.product_custom_specs(product_id);
CREATE INDEX idx_product_custom_specs_tenant_id ON public.product_custom_specs(tenant_id);

-- =============================================
-- Tabel 3: channel_field_mappings (platform admin configuratie)
-- =============================================
CREATE TABLE public.channel_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type TEXT NOT NULL,
  channel_category TEXT,
  sellqo_field TEXT NOT NULL,
  channel_field TEXT NOT NULL,
  channel_field_label TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  transform_rule JSONB,
  field_group TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view mappings" ON public.channel_field_mappings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins can insert mappings" ON public.channel_field_mappings
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can update mappings" ON public.channel_field_mappings
  FOR UPDATE TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "Platform admins can delete mappings" ON public.channel_field_mappings
  FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));

CREATE TRIGGER update_channel_field_mappings_updated_at
  BEFORE UPDATE ON public.channel_field_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_channel_field_mappings_channel_type ON public.channel_field_mappings(channel_type);

-- =============================================
-- Tabel 4: product_channel_warnings (cache)
-- =============================================
CREATE TABLE public.product_channel_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  warning_message TEXT,
  severity TEXT NOT NULL DEFAULT 'error',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_channel_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view own warnings" ON public.product_channel_warnings
  FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant users can insert own warnings" ON public.product_channel_warnings
  FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant users can update own warnings" ON public.product_channel_warnings
  FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant users can delete own warnings" ON public.product_channel_warnings
  FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE INDEX idx_product_channel_warnings_product_id ON public.product_channel_warnings(product_id);
CREATE INDEX idx_product_channel_warnings_tenant_id ON public.product_channel_warnings(tenant_id);

-- =============================================
-- RPC: bulk_update_specifications
-- =============================================
CREATE OR REPLACE FUNCTION public.bulk_update_specifications(
  p_product_ids UUID[],
  p_updates JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_count INTEGER := 0;
  pid UUID;
BEGIN
  FOREACH pid IN ARRAY p_product_ids LOOP
    INSERT INTO product_specifications (product_id, tenant_id)
    SELECT pid, t.tenant_id
    FROM products t WHERE t.id = pid
    ON CONFLICT (product_id) DO NOTHING;
  END LOOP;

  UPDATE product_specifications
  SET
    brand = COALESCE((p_updates->>'brand'), brand),
    country_of_origin = COALESCE((p_updates->>'country_of_origin'), country_of_origin),
    hs_tariff_code = COALESCE((p_updates->>'hs_tariff_code'), hs_tariff_code),
    manufacturer = COALESCE((p_updates->>'manufacturer'), manufacturer),
    updated_at = now()
  WHERE product_id = ANY(p_product_ids);

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;
