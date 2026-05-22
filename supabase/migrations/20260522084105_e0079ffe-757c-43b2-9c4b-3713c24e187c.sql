ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS peppol_legal_entity_id TEXT,
  ADD COLUMN IF NOT EXISTS peppol_auto_send BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS peppol_auto_send_regimes TEXT[];