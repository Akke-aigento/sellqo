-- BILLING-1 — billing_anchor_day op public.subscriptions
--
-- Waarom: de factuurdatum werd elke periode uit de VORIGE factuurdatum
-- afgeleid. Een abonnement dat op de 31e loopt werd in februari naar de 28e
-- geklemd en bleef daar vervolgens hangen, omdat maart weer vanaf de 28e
-- rekende. Deze kolom bewaart de BEDOELDE factuurdag, zodat de periode na een
-- korte maand terugkeert naar de oorspronkelijke dag.
--
-- Strikt additief: geen kolom hernoemd, gedropt of van default gewijzigd.
-- Idempotent: twee keer draaien geeft hetzelfde resultaat.
--
-- DOWN (handmatig, deze migratie heeft er geen):
--   DROP TRIGGER IF EXISTS trg_subscriptions_billing_anchor_day ON public.subscriptions;
--   DROP FUNCTION IF EXISTS public.set_billing_anchor_day();
--   ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_billing_anchor_day_check;
--   ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS billing_anchor_day;

-- 1. Kolom.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_anchor_day smallint;

COMMENT ON COLUMN public.subscriptions.billing_anchor_day IS
  'BILLING-1: bedoelde factuurdag (1-31). Wordt geklemd op het aantal dagen in de doelmaand, maar herstelt daarna naar deze dag. NULL = val terug op de dag van de vorige factuurdatum.';

-- 2. CHECK. ADD CONSTRAINT kent geen IF NOT EXISTS, dus via een guard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass
      AND conname = 'subscriptions_billing_anchor_day_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_billing_anchor_day_check
      CHECK (billing_anchor_day IS NULL OR billing_anchor_day BETWEEN 1 AND 31);
  END IF;
END $$;

-- 3. Grandfather bestaande abonnementen. Vaste conditie, geen now(): het
--    resultaat is reproduceerbaar en de UPDATE raakt bij een tweede run niets
--    meer, omdat alleen NULL-rijen in aanmerking komen.
UPDATE public.subscriptions
   SET billing_anchor_day = EXTRACT(DAY FROM start_date)::smallint
 WHERE billing_anchor_day IS NULL
   AND start_date IS NOT NULL;

-- 4. Nieuwe abonnementen vullen de anchor zelf. Dit gebeurt in de database en
--    niet in de edge-functies: sync-tenant-plan en planEffectuate schrijven op
--    drie plekken een start_date, en elk van die schrijfpaden zou anders de
--    kolom moeten kennen voordat deze migratie gedraaid is.
--    Alleen BEFORE INSERT, en alleen als de anchor nog leeg is — zo overschrijft
--    de trigger nooit een bewust gezette waarde.
CREATE OR REPLACE FUNCTION public.set_billing_anchor_day()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.billing_anchor_day IS NULL AND NEW.start_date IS NOT NULL THEN
    NEW.billing_anchor_day := EXTRACT(DAY FROM NEW.start_date)::smallint;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscriptions_billing_anchor_day ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_billing_anchor_day
  BEFORE INSERT ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_billing_anchor_day();
