-- INKOOP-2 — leveranciersfacturen uit API's (eerst bol.com) als concept in het
-- Odoo-aankoopdagboek. Eén rij per opgehaalde factuur, zodat een volgende run ze
-- nooit opnieuw uploadt. Geschreven door import-supplier-invoices (service role).

CREATE TABLE IF NOT EXISTS public.supplier_invoice_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source text NOT NULL,                 -- 'bol'
  external_id text NOT NULL,            -- factuurnummer bij de leverancier
  invoice_date date,
  invoice_type text,
  payable_amount numeric(12,2),         -- ter info; SellQo boekt geen bedragen
  odoo_move_id bigint,
  status text NOT NULL CHECK (status IN ('created', 'exists')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

ALTER TABLE public.supplier_invoice_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supplier_invoice_imports_read ON public.supplier_invoice_imports;
CREATE POLICY supplier_invoice_imports_read ON public.supplier_invoice_imports FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));
REVOKE ALL ON public.supplier_invoice_imports FROM anon, authenticated;
GRANT SELECT ON public.supplier_invoice_imports TO authenticated;

-- Dagelijks 06:20 UTC. Zelfde auth-patroon als de andere crons (x-cron-secret).
DO $$
BEGIN
  PERFORM cron.unschedule('import-supplier-invoices-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'import-supplier-invoices-daily');
  PERFORM cron.schedule(
    'import-supplier-invoices-daily',
    '20 6 * * *',
    $cmd$
      SELECT net.http_post(
        url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/import-supplier-invoices',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT value FROM public.internal_config WHERE key = 'internal_webhook_secret')
        ),
        body := jsonb_build_object('trigger', 'cron', 'ts', now()),
        timeout_milliseconds := 120000
      );
    $cmd$
  );
END $$;
