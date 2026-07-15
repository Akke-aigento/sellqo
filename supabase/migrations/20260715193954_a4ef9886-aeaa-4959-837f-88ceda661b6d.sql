ALTER TABLE public.tenant_odoo_settings
  ADD COLUMN IF NOT EXISTS channel_aliases jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS channel_partner_ids jsonb NOT NULL DEFAULT '{}'::jsonb;