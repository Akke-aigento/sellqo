ALTER TABLE public.tenant_odoo_settings
  ADD COLUMN IF NOT EXISTS odoo_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS odoo_journal_name text;

ALTER TABLE public.odoo_invoice_sync_log
  ADD COLUMN IF NOT EXISTS credit_note_id uuid REFERENCES public.credit_notes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS peppol_status text,
  ADD COLUMN IF NOT EXISTS peppol_note text;

ALTER TABLE public.odoo_invoice_sync_log
  ALTER COLUMN marketplace_connection_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'odoo_invoice_sync_log_document_type_check'
  ) THEN
    ALTER TABLE public.odoo_invoice_sync_log
      ADD CONSTRAINT odoo_invoice_sync_log_document_type_check
      CHECK (document_type IN ('invoice','credit_note'));
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_odoo_sync_invoice
  ON public.odoo_invoice_sync_log (tenant_id, invoice_id)
  WHERE document_type = 'invoice' AND sync_status = 'synced' AND invoice_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_odoo_sync_credit_note
  ON public.odoo_invoice_sync_log (tenant_id, credit_note_id)
  WHERE document_type = 'credit_note' AND sync_status = 'synced' AND credit_note_id IS NOT NULL;

-- Hourly cron: pings sync-odoo-invoices; function iterates sync-enabled tenants
DO $$
BEGIN
  PERFORM cron.unschedule('sync-odoo-invoices-hourly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-odoo-invoices-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'sync-odoo-invoices-hourly',
  '17 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/sync-odoo-invoices',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjem1mY2Fibm9vZm5tZnB6ZW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMjI3MDYsImV4cCI6MjA4Mzg5ODcwNn0.QBzjHufd95y2kJF3ii7LZS_77nh7BPyVxhOMEGXm8PQ"}'::jsonb,
    body := jsonb_build_object('trigger','cron','ts', now())
  );
  $cron$
);