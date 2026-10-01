-- PAY-LINK-1 — vaste betaallink per openstaande post, bundels ("Alles betalen") en afwijkingen.
--
-- BEWUST GEEN MIGRATIE in supabase/migrations/: chat-Claude voert dit uit via de connector
-- (duplicaat-les). VOLGORDE IS HARD: eerst dit bestand + controle, dán pas de deploy van de
-- functies. Zonder deze tabellen falen de betaalmails (dispatch-payment-request maakt de link aan).
--
-- Strikt additief: drie nieuwe tabellen, geen bestaande tabel, kolom of policy gewijzigd.
-- Idempotent: IF NOT EXISTS overal.
-- RLS aan zonder policies: alleen de service-role (edge functions) leest en schrijft. Niets hier
-- leidt tot een betaling zonder token: elke Stripe-sessie vertrekt van een tokenlookup.
--
-- Terugdraaien (alleen als er nog geen links verstuurd zijn — anders worden die links ongeldig):
--   DROP TABLE IF EXISTS public.payment_anomalies;
--   DROP TABLE IF EXISTS public.payment_bundles;
--   DROP TABLE IF EXISTS public.payment_links;

-- (1) payment_links — één vaste link per cyclus, per factuur, en per klant ("Alles betalen").
CREATE TABLE IF NOT EXISTS public.payment_links (
  token                    text PRIMARY KEY CHECK (token ~ '^[0-9abcdefghjkmnpqrstvwxyz]{26}$'),
  kind                     text NOT NULL CHECK (kind IN ('cycle', 'invoice', 'customer')),
  tenant_id                uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id              uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  billing_cycle_id         uuid REFERENCES public.billing_cycles(id) ON DELETE CASCADE,
  invoice_id               uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  last_checkout_session_id text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  last_opened_at           timestamptz,
  CONSTRAINT payment_links_target_check CHECK (
    (kind = 'cycle'    AND billing_cycle_id IS NOT NULL AND invoice_id IS NULL) OR
    (kind = 'invoice'  AND invoice_id IS NOT NULL AND billing_cycle_id IS NULL) OR
    (kind = 'customer' AND customer_id IS NOT NULL AND billing_cycle_id IS NULL AND invoice_id IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_links_cycle_key    ON public.payment_links (billing_cycle_id) WHERE kind = 'cycle';
CREATE UNIQUE INDEX IF NOT EXISTS payment_links_invoice_key  ON public.payment_links (invoice_id)       WHERE kind = 'invoice';
CREATE UNIQUE INDEX IF NOT EXISTS payment_links_customer_key ON public.payment_links (tenant_id, customer_id) WHERE kind = 'customer';
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

-- (2) payment_bundles — snapshot van de posten die in één Stripe-sessie betaald worden.
CREATE TABLE IF NOT EXISTS public.payment_bundles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id         uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token               text NOT NULL REFERENCES public.payment_links(token) ON DELETE CASCADE,
  items               jsonb NOT NULL,
  total               numeric(12,2) NOT NULL,
  currency            text NOT NULL DEFAULT 'eur',
  checkout_session_id text,
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'superseded')),
  payment_intent_id   text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  paid_at             timestamptz
);
CREATE INDEX IF NOT EXISTS payment_bundles_token_idx ON public.payment_bundles (token, created_at DESC);
ALTER TABLE public.payment_bundles ENABLE ROW LEVEL SECURITY;

-- (3) payment_anomalies — een betaling op een post die al betaald of geannuleerd was.
--     Nooit automatisch terugbetaald (beslissing Akke 01-10); terugbetalen = PLATFORM-BILLING-ADMIN-1.
CREATE TABLE IF NOT EXISTS public.payment_anomalies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              text NOT NULL CHECK (kind IN ('duplicate', 'closed_item')),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  billing_cycle_id  uuid REFERENCES public.billing_cycles(id) ON DELETE SET NULL,
  invoice_id        uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  bundle_id         uuid REFERENCES public.payment_bundles(id) ON DELETE SET NULL,
  payment_intent_id text NOT NULL,
  amount            numeric(12,2),
  currency          text,
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
-- Eén rij per (intent, post): een webhook-retry van dezelfde dubbele betaling maakt geen tweede rij.
CREATE UNIQUE INDEX IF NOT EXISTS payment_anomalies_intent_target_key
  ON public.payment_anomalies (payment_intent_id, coalesce(billing_cycle_id, invoice_id));
ALTER TABLE public.payment_anomalies ENABLE ROW LEVEL SECURITY;

-- (4) CONTROLE — moet drie rijen met rls = true en 0 policies geven.
SELECT c.relname AS tabel, c.relrowsecurity AS rls,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('payment_links', 'payment_bundles', 'payment_anomalies')
ORDER BY 1;
