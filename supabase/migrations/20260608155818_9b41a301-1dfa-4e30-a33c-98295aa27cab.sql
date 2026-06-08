CREATE TABLE IF NOT EXISTS public.tenant_odoo_settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  aggregate_b2c_customers BOOLEAN NOT NULL DEFAULT false,
  b2c_dummy_partner_name TEXT NOT NULL DEFAULT 'Diverse particulieren',
  b2c_dummy_partner_odoo_id INTEGER,
  aggregate_per_channel BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_odoo_settings TO authenticated;
GRANT ALL ON public.tenant_odoo_settings TO service_role;

ALTER TABLE public.tenant_odoo_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tos_select_tenant_members" ON public.tenant_odoo_settings
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY "tos_insert_admin_accountant" ON public.tenant_odoo_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','accountant']::app_role[])
  );

CREATE POLICY "tos_update_admin_accountant" ON public.tenant_odoo_settings
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','accountant']::app_role[])
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','accountant']::app_role[])
  );

CREATE POLICY "tos_delete_admin_accountant" ON public.tenant_odoo_settings
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, ARRAY['tenant_admin','accountant']::app_role[])
  );

CREATE TRIGGER trg_tenant_odoo_settings_updated_at
  BEFORE UPDATE ON public.tenant_odoo_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();