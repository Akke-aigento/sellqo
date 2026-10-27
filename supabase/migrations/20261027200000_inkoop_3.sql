-- INKOOP-3 — SellQo als facturen-inbox voor elke winkel, Odoo als bestemming.
--
-- Akke 27-10: "alles via SellQo laten lopen en doorzwieren naar Odoo, de standaard,
-- ook voor tenants". supplier_documents (bestond al, ongebruikt) wordt de inbox:
--   - leverancier optioneel: een binnengekomen factuur is eerst "te verwerken";
--   - bron (upload, e-mail, bol, odoo_archive) + extern id tegen dubbels;
--   - Odoo-koppeling (move-id, status, fout) — enkel de server schrijft die;
--   - per winkel een vlag push_supplier_documents: nieuwe facturen gaan meteen als
--     concept naar Odoo (trigger → import-supplier-invoices mode=push).

-- 1. Leveranciersdocumenten
ALTER TABLE public.supplier_documents ALTER COLUMN supplier_id DROP NOT NULL;
ALTER TABLE public.supplier_documents
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS odoo_move_id bigint,
  ADD COLUMN IF NOT EXISTS odoo_status text,
  ADD COLUMN IF NOT EXISTS odoo_error text,
  ADD COLUMN IF NOT EXISTS odoo_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS odoo_attempts integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.supplier_documents ADD CONSTRAINT supplier_documents_source_check
    CHECK (source IN ('upload', 'email', 'bol', 'odoo_archive'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Een document wijst enkel naar bestanden van de eigen winkel (de push haalt het bestand
-- op met de service role: zonder deze regel kon een winkel het pad van een andere invullen).
DO $$ BEGIN
  ALTER TABLE public.supplier_documents ADD CONSTRAINT supplier_documents_storage_path_tenant_check
    CHECK (storage_path IS NULL OR storage_path LIKE tenant_id::text || '/%');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.supplier_documents ADD CONSTRAINT supplier_documents_odoo_status_check
    CHECK (odoo_status IS NULL OR odoo_status IN ('pending', 'draft', 'posted', 'cancel', 'error'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS supplier_documents_external_uniq
  ON public.supplier_documents (tenant_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS supplier_documents_odoo_move_uniq
  ON public.supplier_documents (tenant_id, odoo_move_id) WHERE odoo_move_id IS NOT NULL;

-- Clients mogen de Odoo-kolommen, de bron en het externe id niet zelf zetten of wijzigen.
REVOKE INSERT, UPDATE ON public.supplier_documents FROM authenticated;
GRANT INSERT (id, tenant_id, supplier_id, purchase_order_id, document_type, document_number, document_date,
              file_name, file_url, file_size, mime_type, storage_path, amount, tax_amount, total_amount,
              currency, due_date, payment_status, paid_at, paid_amount, notes)
  ON public.supplier_documents TO authenticated;
GRANT UPDATE (supplier_id, purchase_order_id, document_type, document_number, document_date,
              amount, tax_amount, total_amount, currency, due_date, payment_status, paid_at, paid_amount,
              notes, updated_at)
  ON public.supplier_documents TO authenticated;

-- 2. Leveranciers: koppeling met de Odoo-partner (vinden of aanmaken bij terugsync)
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS odoo_partner_id bigint;
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_odoo_partner_uniq
  ON public.suppliers (tenant_id, odoo_partner_id) WHERE odoo_partner_id IS NOT NULL;

-- 3. Odoo-instelling per winkel
ALTER TABLE public.tenant_odoo_settings
  ADD COLUMN IF NOT EXISTS push_supplier_documents boolean NOT NULL DEFAULT false;

-- 4. Meteen doorsturen: na elke nieuwe factuur/creditnota van een winkel die dat wil.
CREATE OR REPLACE FUNCTION public.supplier_document_push_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.document_type IN ('invoice', 'credit_note')
     AND NEW.odoo_move_id IS NULL
     AND NEW.source <> 'odoo_archive'
     AND EXISTS (SELECT 1 FROM public.tenant_odoo_settings s
                  WHERE s.tenant_id = NEW.tenant_id AND s.push_supplier_documents) THEN
    PERFORM net.http_post(
      url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/import-supplier-invoices',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'internal_webhook_secret')
      ),
      body := jsonb_build_object('mode', 'push', 'tenantId', NEW.tenant_id, 'documentId', NEW.id),
      timeout_milliseconds := 120000
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nooit een upload laten mislukken door het doorsturen: de dagelijkse run pikt hem op.
  RAISE WARNING 'supplier_document_push_trigger: %', SQLERRM;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.supplier_document_push_trigger() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_supplier_document_push ON public.supplier_documents;
CREATE TRIGGER trg_supplier_document_push
  AFTER INSERT ON public.supplier_documents
  FOR EACH ROW EXECUTE FUNCTION public.supplier_document_push_trigger();
