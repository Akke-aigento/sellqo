-- INKOOP-6 — instellingen van de facturen-inbox (Akke 28-10).
--
-- Het facturenadres is <winkel>+facturen@mail.sellqo.app: te raden. Wie het raadt, kon
-- een pdf als concept in de Odoo van een winkel zetten. Daarom:
--   - mail van een afzender die de winkel nog niet vertrouwt, komt binnen als
--     "te controleren" (review_status = 'pending') en gaat niet naar Odoo;
--   - goedkeuren (eenmalig of de afzender voortaan vertrouwen) stuurt hem alsnog door;
--   - weigeren zet het document op "overig"; een geblokkeerde afzender komt niet meer binnen.
-- Instellingen per winkel: afzenders controleren (standaard aan). Meldingen lopen via
-- de gewone meldingsvoorkeuren (types supplier_invoice_*).

-- 1. Documenten: afzender + controle
ALTER TABLE public.supplier_documents
  ADD COLUMN IF NOT EXISTS sender_email text,
  -- DMARC geslaagd volgens Resend: enkel dan is sender_email bewezen.
  ADD COLUMN IF NOT EXISTS sender_authenticated boolean,
  ADD COLUMN IF NOT EXISTS review_status text;
DO $$ BEGIN
  ALTER TABLE public.supplier_documents ADD CONSTRAINT supplier_documents_review_status_check
    CHECK (review_status IS NULL OR review_status IN ('pending', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS supplier_documents_review_idx
  ON public.supplier_documents (tenant_id) WHERE review_status = 'pending';

-- 2. Instellingen per winkel
CREATE TABLE IF NOT EXISTS public.supplier_inbox_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  require_sender_approval boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_inbox_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Finance roles read inbox settings" ON public.supplier_inbox_settings;
CREATE POLICY "Finance roles read inbox settings" ON public.supplier_inbox_settings FOR SELECT
  USING (is_platform_admin(auth.uid()) OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
         AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role]));
DROP POLICY IF EXISTS "Tenant admins write inbox settings" ON public.supplier_inbox_settings;
CREATE POLICY "Tenant admins write inbox settings" ON public.supplier_inbox_settings FOR ALL
  USING (is_platform_admin(auth.uid())
         OR (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])))
  WITH CHECK (is_platform_admin(auth.uid())
         OR (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())) AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role])));
GRANT SELECT, INSERT, UPDATE ON public.supplier_inbox_settings TO authenticated;

-- 3. Afzenders: vertrouwd of geblokkeerd (schrijven enkel via de functies hieronder)
CREATE TABLE IF NOT EXISTS public.supplier_inbox_senders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email = lower(btrim(email)) AND email LIKE '%@%'),
  status text NOT NULL CHECK (status IN ('approved', 'blocked')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
ALTER TABLE public.supplier_inbox_senders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Finance roles read inbox senders" ON public.supplier_inbox_senders;
CREATE POLICY "Finance roles read inbox senders" ON public.supplier_inbox_senders FOR SELECT
  USING (is_platform_admin(auth.uid()) OR tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
         AND has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role]));
REVOKE INSERT, UPDATE, DELETE ON public.supplier_inbox_senders FROM authenticated, anon;
GRANT SELECT ON public.supplier_inbox_senders TO authenticated;

-- 4. Beslissen over een document dat wacht (of de afzender ervan)
--    approve        dit document doorlaten
--    approve_sender dit document + alles van deze afzender, en voortaan vertrouwen
--    reject         dit document weigeren (blijft bewaard als "overig")
--    block_sender   weigeren + alles van deze afzender, en voortaan niet meer binnenlaten
CREATE OR REPLACE FUNCTION public.supplier_inbox_review(p_document_id uuid, p_decision text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_sender text;
  v_status text;
  v_count integer := 0;
BEGIN
  SELECT tenant_id, sender_email, review_status INTO v_tenant, v_sender, v_status
    FROM supplier_documents WHERE id = p_document_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Document niet gevonden'; END IF;
  IF p_decision NOT IN ('approve', 'approve_sender', 'reject', 'block_sender') THEN
    RAISE EXCEPTION 'Onbekende beslissing %', p_decision;
  END IF;
  -- Per document: financiële rollen. Een afzender blijvend vertrouwen of blokkeren:
  -- enkel de beheerder (die kan het ook weer weghalen).
  IF NOT (is_platform_admin(auth.uid())
          OR (v_tenant IN (SELECT get_user_tenant_ids(auth.uid()))
              AND has_tenant_role(v_tenant, CASE WHEN p_decision IN ('approve_sender', 'block_sender')
                                                 THEN ARRAY['tenant_admin'::app_role]
                                                 ELSE ARRAY['tenant_admin'::app_role, 'staff'::app_role, 'accountant'::app_role] END))) THEN
    RAISE EXCEPTION 'Geen toegang' USING ERRCODE = '42501';
  END IF;
  IF p_decision IN ('approve_sender', 'block_sender') AND v_sender IS NULL THEN
    RAISE EXCEPTION 'Dit document heeft geen afzender';
  END IF;

  IF p_decision IN ('approve_sender', 'block_sender') THEN
    INSERT INTO supplier_inbox_senders (tenant_id, email, status, created_by)
    VALUES (v_tenant, v_sender, CASE WHEN p_decision = 'approve_sender' THEN 'approved' ELSE 'blocked' END, auth.uid())
    ON CONFLICT (tenant_id, email) DO UPDATE SET status = EXCLUDED.status, created_by = EXCLUDED.created_by, created_at = now();
  END IF;

  -- Doorlaten: review_status weg → de trigger stuurt naar Odoo (als de winkel dat wil).
  IF p_decision IN ('approve', 'approve_sender') THEN
    UPDATE supplier_documents SET review_status = NULL, updated_at = now()
     WHERE tenant_id = v_tenant AND review_status = 'pending'
       -- Enkel bewezen mails van die afzender meenemen: een vervalste (DMARC fail) met
       -- hetzelfde From-adres blijft wachten.
       AND (id = p_document_id
            OR (p_decision = 'approve_sender' AND sender_email = v_sender AND sender_authenticated IS TRUE));
  ELSE
    UPDATE supplier_documents SET review_status = 'rejected', document_type = 'other', updated_at = now()
     WHERE tenant_id = v_tenant AND review_status = 'pending'
       AND (id = p_document_id OR (p_decision = 'block_sender' AND sender_email = v_sender));
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.supplier_inbox_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_inbox_review(uuid, text) TO authenticated;

-- Een afzender uit de lijst halen (opnieuw "te controleren").
CREATE OR REPLACE FUNCTION public.supplier_inbox_sender_remove(p_sender_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM supplier_inbox_senders WHERE id = p_sender_id;
  IF v_tenant IS NULL THEN RETURN; END IF;
  IF NOT (is_platform_admin(auth.uid())
          OR (v_tenant IN (SELECT get_user_tenant_ids(auth.uid()))
              AND has_tenant_role(v_tenant, ARRAY['tenant_admin'::app_role]))) THEN
    RAISE EXCEPTION 'Geen toegang' USING ERRCODE = '42501';
  END IF;
  DELETE FROM supplier_inbox_senders WHERE id = p_sender_id;
END $$;
REVOKE ALL ON FUNCTION public.supplier_inbox_sender_remove(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_inbox_sender_remove(uuid) TO authenticated;

-- 5. Doorsturen: niet bij "te controleren"; wel zodra het goedgekeurd wordt.
CREATE OR REPLACE FUNCTION public.supplier_document_push_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (OLD.review_status = 'pending' AND NEW.review_status IS NULL) THEN
    RETURN NEW;
  END IF;
  IF NEW.document_type IN ('invoice', 'credit_note')
     AND NEW.odoo_move_id IS NULL
     AND NEW.review_status IS NULL
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
  RAISE WARNING 'supplier_document_push_trigger: %', SQLERRM;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.supplier_document_push_trigger() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_supplier_document_push ON public.supplier_documents;
CREATE TRIGGER trg_supplier_document_push
  AFTER INSERT OR UPDATE OF review_status ON public.supplier_documents
  FOR EACH ROW EXECUTE FUNCTION public.supplier_document_push_trigger();

-- 6. Bestaande mail-documenten: afzender invullen (stond al in extracted_data).
UPDATE public.supplier_documents
   SET sender_email = x.addr
  FROM (SELECT id, lower(btrim(coalesce(substring(extracted_data->'email'->>'from' from '<([^>]+)>'),
                                        extracted_data->'email'->>'from'))) AS addr
          FROM public.supplier_documents
         WHERE source = 'email' AND sender_email IS NULL) x
 WHERE x.id = supplier_documents.id
   -- zelfde regel als senderAddress(): anders leeg laten
   AND x.addr ~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$';

-- Vertrouwde afzenders worden niet in deze (publieke) migratie gezet, maar per winkel in
-- de app of rechtstreeks in de databank.
