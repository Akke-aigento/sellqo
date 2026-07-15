
-- Canonical Peppol vocabulary
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_peppol_status_check
  CHECK (peppol_status IS NULL OR peppol_status IN ('not_applicable','archive_only','pending','sent','manual_action'))
  NOT VALID;
ALTER TABLE public.invoices VALIDATE CONSTRAINT invoices_peppol_status_check;

ALTER TABLE public.credit_notes
  ADD CONSTRAINT credit_notes_peppol_status_check
  CHECK (peppol_status IS NULL OR peppol_status IN ('not_applicable','archive_only','pending','sent','manual_action'))
  NOT VALID;
ALTER TABLE public.credit_notes VALIDATE CONSTRAINT credit_notes_peppol_status_check;

-- Peppol sent timestamp on credit notes (parity with invoices)
ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS peppol_sent_at timestamptz;

-- Per-tenant toggle for Peppol dispatch from Odoo sync
ALTER TABLE public.tenant_odoo_settings
  ADD COLUMN IF NOT EXISTS peppol_send_enabled boolean NOT NULL DEFAULT true;
