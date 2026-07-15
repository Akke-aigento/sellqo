ALTER TABLE public.tenant_odoo_settings
  ADD COLUMN IF NOT EXISTS odoo_auto_post boolean NOT NULL DEFAULT true;