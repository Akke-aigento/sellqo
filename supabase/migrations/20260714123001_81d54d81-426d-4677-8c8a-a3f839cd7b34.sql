
CREATE TABLE IF NOT EXISTS public.tenant_odoo_credentials (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  odoo_url TEXT NOT NULL,
  odoo_db TEXT NOT NULL,
  odoo_login TEXT NOT NULL,
  api_key_ciphertext TEXT NOT NULL,
  connected_version TEXT,
  last_test_at TIMESTAMPTZ,
  last_test_ok BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.tenant_odoo_credentials TO service_role;

ALTER TABLE public.tenant_odoo_credentials ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies: only service_role (edge functions) can access.

CREATE OR REPLACE FUNCTION public.update_tenant_odoo_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_tenant_odoo_credentials_updated_at ON public.tenant_odoo_credentials;
CREATE TRIGGER trg_tenant_odoo_credentials_updated_at
BEFORE UPDATE ON public.tenant_odoo_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_tenant_odoo_credentials_updated_at();

-- Extend tenant_odoo_settings with journal id (authoritative)
ALTER TABLE public.tenant_odoo_settings
  ADD COLUMN IF NOT EXISTS odoo_journal_id TEXT;
