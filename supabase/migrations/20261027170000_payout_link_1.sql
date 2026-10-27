-- PAYOUT-LINK-1 — welke Stripe-uitbetaling hoort bij welke factuur (zie
-- supabase/functions/_shared/payoutLink.ts). Eén rij per uitbetaling, één per
-- balance transaction. Geschreven door de edge function link-stripe-payouts (service role);
-- leesbaar voor platformbeheerders en voor de beheerder/boekhouder van de eigen winkel.

CREATE TABLE IF NOT EXISTS public.stripe_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_account text NOT NULL,             -- 'platform' of acct_…
  payout_id text NOT NULL UNIQUE,           -- po_…
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'eur',
  arrival_date date NOT NULL,
  status text NOT NULL,
  txn_count integer NOT NULL DEFAULT 0,
  gross_cents bigint NOT NULL DEFAULT 0,
  fee_cents bigint NOT NULL DEFAULT 0,
  linked_count integer NOT NULL DEFAULT 0,
  unlinked jsonb NOT NULL DEFAULT '[]'::jsonb,
  odoo_status text NOT NULL DEFAULT 'partial' CHECK (odoo_status IN ('done', 'partial', 'gaps')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stripe_payouts_tenant_arrival_idx ON public.stripe_payouts (tenant_id, arrival_date DESC);

CREATE TABLE IF NOT EXISTS public.stripe_payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payout_id text NOT NULL,                  -- po_… (geen FK: elke supabase-js-aanroep is een eigen transactie)
  balance_txn_id text NOT NULL UNIQUE,      -- txn_…
  type text NOT NULL,
  amount_cents bigint NOT NULL,
  fee_cents bigint NOT NULL DEFAULT 0,      -- alle kosten
  app_fee_cents bigint NOT NULL DEFAULT 0,  -- waarvan SellQo-platformfee (application fee)
  net_cents bigint NOT NULL,
  payment_intent_id text,
  refund_id text,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{type,id,number,odoo_move_id}]
  document_type text,
  document_id uuid,
  document_number text,
  odoo_move_id text,
  odoo_noted_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stripe_payout_items_payout_idx ON public.stripe_payout_items (payout_id);
CREATE INDEX IF NOT EXISTS stripe_payout_items_document_idx ON public.stripe_payout_items (document_id);

ALTER TABLE public.stripe_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_payout_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stripe_payouts_read ON public.stripe_payouts;
CREATE POLICY stripe_payouts_read ON public.stripe_payouts FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid() AND ur.tenant_id = stripe_payouts.tenant_id
                  AND ur.role IN ('tenant_admin', 'accountant'))
  );

DROP POLICY IF EXISTS stripe_payout_items_read ON public.stripe_payout_items;
CREATE POLICY stripe_payout_items_read ON public.stripe_payout_items FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid() AND ur.tenant_id = stripe_payout_items.tenant_id
                  AND ur.role IN ('tenant_admin', 'accountant'))
  );

-- Clients mogen enkel lezen (via de policies hierboven); schrijven doet de service role.
REVOKE ALL ON public.stripe_payouts FROM anon, authenticated;
REVOKE ALL ON public.stripe_payout_items FROM anon, authenticated;
GRANT SELECT ON public.stripe_payouts TO authenticated;
GRANT SELECT ON public.stripe_payout_items TO authenticated;

-- Dagelijks om 07:40 (Brussel, wintertijd = 06:40 UTC), na de uurlijkse Odoo-sync van :17.
-- Zelfde auth-patroon als sync-odoo-invoices-hourly: x-cron-secret uit internal_config.
DO $$
BEGIN
  PERFORM cron.unschedule('link-stripe-payouts-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'link-stripe-payouts-daily');
  PERFORM cron.schedule(
    'link-stripe-payouts-daily',
    '40 6 * * *',
    $cmd$
      SELECT net.http_post(
        url := 'https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/link-stripe-payouts',
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
