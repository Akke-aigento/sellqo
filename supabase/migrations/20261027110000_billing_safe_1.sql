-- BILLING-SAFE-1 — mislukte automatische afschrijving en "verlengd vóór betaling".
--
-- 1. billing_cycles.charge_failed_at / charge_failure_reason (strikt additief).
--    Claim-kolom: runner én webhook kunnen een mislukte afschrijving melden; de
--    eerste die charge_failed_at zet, stuurt het betaalverzoek en de melding
--    (_shared/billingAlerts.ts → handleCycleChargeFailure).
--
-- 2. handle_subscription_notification: "Abonnement verlengd" ging af zodra de
--    runner next_invoice_date opschoof — vóór (en los van) de betaling. Bij
--    pay-first-abonnementen vervalt die melding; de melding "Betaling ontvangen"
--    na de afboeking vervangt ze. De rest van de functie is letterlijk de live
--    definitie van 27-10-2026 (md5 9858bdb6b498588cc662352139db9a6e).
--
-- 3. Eén melding per dedupe-sleutel, ook bij gelijktijdige webhook-leveringen
--    (notifyOnce kijkt eerst en voegt dan in; de index maakt dat waterdicht).
--
-- Let op: billing_model is een enum (public.billing_model). COALESCE(..., '')
-- faalt daar bij het parsen ("invalid input value for enum"), dus IS DISTINCT FROM.
--
-- DOWN (handmatig):
--   alter table public.billing_cycles drop column if exists charge_failed_at,
--     drop column if exists charge_failure_reason;
--   drop index if exists public.notifications_dedupe_key_uniq;
--   en de functie terugzetten uit snapshots.platform_20261027_billing_safe_1.

ALTER TABLE public.billing_cycles ADD COLUMN IF NOT EXISTS charge_failed_at timestamptz;
ALTER TABLE public.billing_cycles ADD COLUMN IF NOT EXISTS charge_failure_reason text;

CREATE OR REPLACE FUNCTION public.handle_subscription_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_type TEXT;
  v_priority TEXT;
  v_action_url TEXT;
  v_customer_name TEXT;
BEGIN
  v_action_url := '/admin/subscriptions';

  -- Haal klantnaam op
  SELECT COALESCE(
    NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''),
    company_name,
    email
  ) INTO v_customer_name
  FROM public.customers WHERE id = NEW.customer_id;
  v_customer_name := COALESCE(v_customer_name, 'Onbekende klant');

  -- NIEUW ABONNEMENT
  IF TG_OP = 'INSERT' THEN
    v_type := 'subscription_new';
    v_title := 'Nieuw abonnement: ' || NEW.name;
    v_message := 'Abonnement "' || NEW.name || '" voor ' || v_customer_name || ' (€' || ROUND(NEW.total::numeric, 2) || '/' || NEW.interval || ')';
    v_priority := 'medium';

  -- ABONNEMENT OPGEZEGD
  ELSIF TG_OP = 'UPDATE'
        AND NEW.status = 'cancelled'
        AND OLD.status != 'cancelled' THEN
    v_type := 'subscription_cancelled';
    v_title := 'Abonnement opgezegd: ' || NEW.name;
    v_message := 'Abonnement "' || NEW.name || '" van ' || v_customer_name || ' is opgezegd';
    v_priority := 'high';

  -- ABONNEMENT GEPAUZEERD
  ELSIF TG_OP = 'UPDATE'
        AND NEW.status = 'paused'
        AND OLD.status != 'paused' THEN
    v_type := 'subscription_paused';
    v_title := 'Abonnement gepauzeerd: ' || NEW.name;
    v_message := 'Abonnement "' || NEW.name || '" van ' || v_customer_name || ' is gepauzeerd';
    v_priority := 'medium';

  -- ABONNEMENT VERLENGD (next_invoice_date schuift op na facturatie)
  -- BILLING-SAFE-1: niet bij pay-first — daar schuift de datum op vóór de betaling.
  ELSIF TG_OP = 'UPDATE'
        AND NEW.next_invoice_date > OLD.next_invoice_date
        AND NEW.status = 'active'
        AND NEW.billing_model IS DISTINCT FROM 'pay_first' THEN
    v_type := 'subscription_renewed';
    v_title := 'Abonnement verlengd: ' || NEW.name;
    v_message := 'Abonnement "' || NEW.name || '" van ' || v_customer_name || ' is verlengd tot ' || to_char(NEW.next_invoice_date, 'DD-MM-YYYY');
    v_priority := 'low';

  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.send_notification(
    NEW.tenant_id,
    'subscriptions',
    v_type,
    v_title,
    v_message,
    v_priority,
    v_action_url,
    jsonb_build_object(
      'subscription_id', NEW.id,
      'subscription_name', NEW.name,
      'customer_name', v_customer_name,
      'total', NEW.total,
      'interval', NEW.interval,
      'status', NEW.status
    )
  );

  RETURN NEW;
END;
$function$;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_uniq
  ON public.notifications (tenant_id, type, (data->>'dedupe_key'))
  WHERE data ? 'dedupe_key';

-- Controle na uitrol:
--   select column_name from information_schema.columns
--    where table_name = 'billing_cycles' and column_name like 'charge_fail%';
--   select position('pay_first' in pg_get_functiondef('public.handle_subscription_notification'::regproc)) > 0;
