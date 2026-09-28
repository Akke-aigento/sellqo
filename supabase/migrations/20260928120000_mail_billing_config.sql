-- MAIL-BILLING-1 — configuratie voor de edge function mail-billing-api
-- (Studio Akke Mail factureert zijn klanten via SellQo, tenant "Studio Akke").
--
-- Strikt additief. Idempotent: twee keer draaien geeft hetzelfde resultaat.
--
-- 1. Twee sleutels in internal_config, met een LEGE plaatshouder.
--    internal_config.value is NOT NULL, dus geen NULL; een lege waarde betekent
--    voor mail-billing-api "niet ingesteld" en geeft 503 {code:"niet_ingesteld"}.
--    Zolang ze leeg zijn, is de functie dus dicht.
--    ON CONFLICT DO NOTHING: een al ingestelde waarde wordt nooit overschreven.
--
--    Instellen (NIET in deze migratie, niet in chat en niet in de repo):
--      -- geheim: sterk willekeurig, in de database zelf gegenereerd
--      UPDATE public.internal_config
--         SET value = encode(extensions.gen_random_bytes(32), 'hex')
--       WHERE key = 'mail_billing_secret' AND value = '';
--      -- tenant: het id van de tenant "Studio Akke" (bestaat nog niet op 28-09)
--      UPDATE public.internal_config SET value = '<uuid van tenant Studio Akke>'
--       WHERE key = 'mail_billing_tenant_id';
--    Daarna de waarde van mail_billing_secret één keer overnemen in de vault van
--    de mail-app (Beheer → Systeem → SellQo-koppeling).
--
-- 2. Gedeeltelijke unieke index op customers (tenant_id, external_id) voor de
--    klanten van de mail-app (external_id 'mail:<org-uuid>'). Raakt geen enkele
--    bestaande rij: vóór deze batch bestaat er geen external_id met 'mail:'.
--    De bestaande niet-unieke idx_customers_external blijft ongemoeid.
--
-- TERUGDRAAIEN (handmatig, deze migratie heeft geen DOWN):
--   DROP INDEX IF EXISTS public.customers_mail_external_id_unique;
--   DELETE FROM public.internal_config
--    WHERE key IN ('mail_billing_secret', 'mail_billing_tenant_id');
--   (Het tweede statement zet de functie dicht: zonder geheim geeft ze 503.)

INSERT INTO public.internal_config (key, value)
VALUES
  ('mail_billing_secret', ''),
  ('mail_billing_tenant_id', '')
ON CONFLICT (key) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS customers_mail_external_id_unique
  ON public.customers (tenant_id, external_id)
  WHERE external_id LIKE 'mail:%';
