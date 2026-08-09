-- LOVEKE-POD-1a: Printful (print-on-demand) foundation

-- a) Credentials (deny-all RLS; service-role only)
CREATE TABLE IF NOT EXISTS public.tenant_printful_credentials (
  tenant_id uuid PRIMARY KEY NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token_ciphertext text NOT NULL,
  store_id text,
  webhook_secret_hash text,
  connected_store_name text,
  last_test_at timestamptz,
  last_test_ok boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.tenant_printful_credentials TO service_role;
ALTER TABLE public.tenant_printful_credentials ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies: deny-all for anon/authenticated (mirrors tenant_odoo_credentials).

-- b) Settings
CREATE TABLE IF NOT EXISTS public.tenant_printful_settings (
  tenant_id uuid PRIMARY KEY NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  printful_sync_enabled boolean NOT NULL DEFAULT false,
  auto_forward_orders boolean NOT NULL DEFAULT false,
  forward_on_payment_status text NOT NULL DEFAULT 'paid',
  auto_confirm boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_printful_settings TO authenticated;
GRANT ALL ON public.tenant_printful_settings TO service_role;
ALTER TABLE public.tenant_printful_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tps_select_tenant_members ON public.tenant_printful_settings
  FOR SELECT TO authenticated
  USING (
    (is_platform_admin(auth.uid()) OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
    AND has_tenant_role(tenant_id, ARRAY['tenant_admin','viewer']::app_role[])
  );

CREATE POLICY tps_insert_admin ON public.tenant_printful_settings
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY tps_update_admin ON public.tenant_printful_settings
  FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY tps_delete_admin ON public.tenant_printful_settings
  FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- c) Variant mappings
CREATE TABLE IF NOT EXISTS public.printful_variant_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  printful_sync_variant_id bigint NOT NULL,
  printful_sync_product_id bigint,
  printful_variant_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT printful_variant_mappings_tenant_variant_key UNIQUE (tenant_id, variant_id)
);

CREATE INDEX IF NOT EXISTS printful_variant_mappings_tenant_sync_variant_idx
  ON public.printful_variant_mappings (tenant_id, printful_sync_variant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.printful_variant_mappings TO authenticated;
GRANT ALL ON public.printful_variant_mappings TO service_role;
ALTER TABLE public.printful_variant_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY pvm_select_tenant_members ON public.printful_variant_mappings
  FOR SELECT TO authenticated
  USING (is_platform_admin(auth.uid()) OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY pvm_insert_admin ON public.printful_variant_mappings
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY pvm_update_admin ON public.printful_variant_mappings
  FOR UPDATE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]))
  WITH CHECK (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

CREATE POLICY pvm_delete_admin ON public.printful_variant_mappings
  FOR DELETE TO authenticated
  USING (is_platform_admin(auth.uid()) OR has_tenant_role(tenant_id, ARRAY['tenant_admin']::app_role[]));

-- updated_at triggers (existing project pattern)
DROP TRIGGER IF EXISTS update_tenant_printful_credentials_updated_at ON public.tenant_printful_credentials;
CREATE TRIGGER update_tenant_printful_credentials_updated_at
  BEFORE UPDATE ON public.tenant_printful_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_printful_settings_updated_at ON public.tenant_printful_settings;
CREATE TRIGGER update_tenant_printful_settings_updated_at
  BEFORE UPDATE ON public.tenant_printful_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_printful_variant_mappings_updated_at ON public.printful_variant_mappings;
CREATE TRIGGER update_printful_variant_mappings_updated_at
  BEFORE UPDATE ON public.printful_variant_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();