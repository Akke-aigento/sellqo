-- LOYALTY-1 (13-10-2026) — loyaliteitsprogramma werkend maken.
--
-- 1. Ontbrekende velden die het admin-formulier al toonde: programma-omschrijving,
--    maximaal inwisselpercentage, en een kortingspercentage per niveau.
-- 2. Webshoporders verdienen automatisch punten zodra ze betaald zijn (eenmalig per
--    order), met de vermenigvuldiger van het huidige niveau. Een geannuleerde of
--    terugbetaalde order boekt de punten terug. Het niveau volgt het totaal verdiende.
--    Marketplace-orders (bol, amazon, ebay) tellen niet mee: die klanten zijn niet de
--    klanten van de winkel. POS-verkopen kennen punten al zelf toe (usePOSLoyalty) en
--    maken geen orders aan, dus er is geen dubbeltelling.
-- Geen mails, geen geld: alleen puntensaldi.

ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS max_redemption_percentage numeric;
ALTER TABLE public.loyalty_tiers ADD COLUMN IF NOT EXISTS discount_percentage numeric;

-- Eén verdien- en één terugboekregel per order (idempotent bij herhaalde updates).
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_tx_order_earn
  ON public.loyalty_transactions (order_id) WHERE order_id IS NOT NULL AND transaction_type = 'earn';
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_tx_order_reversal
  ON public.loyalty_transactions (order_id) WHERE order_id IS NOT NULL AND transaction_type = 'adjustment';

CREATE OR REPLACE FUNCTION public.loyalty_recompute_tier(p_customer_loyalty_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE customer_loyalty cl
     SET current_tier_id = (
       SELECT t.id FROM loyalty_tiers t
        WHERE t.loyalty_program_id = cl.loyalty_program_id
          AND t.min_points <= cl.points_earned_total
        ORDER BY t.min_points DESC
        LIMIT 1)
   WHERE cl.id = p_customer_loyalty_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.loyalty_award_for_order(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  o record;
  prog record;
  cl record;
  v_mult numeric := 1;
  v_points integer;
BEGIN
  SELECT id, tenant_id, customer_id, total, payment_status::text AS ps, status::text AS st,
         coalesce(marketplace_source::text, '') AS src
    INTO o FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR o.customer_id IS NULL OR o.ps <> 'paid'
     OR o.src IN ('bol_com', 'amazon', 'ebay')
     OR o.st IN ('cancelled', 'refunded') THEN
    RETURN 0;
  END IF;

  SELECT * INTO prog FROM loyalty_programs WHERE tenant_id = o.tenant_id AND is_active = true LIMIT 1;
  IF NOT FOUND OR coalesce(prog.points_per_euro, 0) <= 0 THEN
    RETURN 0;
  END IF;

  -- Al toegekend? Dan niets doen.
  IF EXISTS (SELECT 1 FROM loyalty_transactions WHERE order_id = o.id AND transaction_type = 'earn') THEN
    RETURN 0;
  END IF;

  INSERT INTO customer_loyalty (customer_id, loyalty_program_id)
  VALUES (o.customer_id, prog.id)
  ON CONFLICT (customer_id, loyalty_program_id) DO NOTHING;
  SELECT * INTO cl FROM customer_loyalty WHERE customer_id = o.customer_id AND loyalty_program_id = prog.id;

  IF cl.current_tier_id IS NOT NULL THEN
    SELECT coalesce(points_multiplier, 1) INTO v_mult FROM loyalty_tiers WHERE id = cl.current_tier_id;
  END IF;

  v_points := floor(coalesce(o.total, 0) * prog.points_per_euro * coalesce(v_mult, 1));
  IF v_points <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO loyalty_transactions (customer_loyalty_id, transaction_type, points, order_id, description, expires_at)
  VALUES (cl.id, 'earn', v_points, o.id, 'Punten voor bestelling',
          CASE WHEN prog.points_expiry_days IS NOT NULL AND prog.points_expiry_days > 0
               THEN now() + make_interval(days => prog.points_expiry_days) END)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  UPDATE customer_loyalty
     SET points_balance = points_balance + v_points,
         points_earned_total = points_earned_total + v_points,
         last_activity_at = now()
   WHERE id = cl.id;
  PERFORM loyalty_recompute_tier(cl.id);
  RETURN v_points;
END;
$function$;

CREATE OR REPLACE FUNCTION public.loyalty_reverse_for_order(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  e record;
BEGIN
  SELECT * INTO e FROM loyalty_transactions WHERE order_id = p_order_id AND transaction_type = 'earn';
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  INSERT INTO loyalty_transactions (customer_loyalty_id, transaction_type, points, order_id, description)
  VALUES (e.customer_loyalty_id, 'adjustment', -e.points, p_order_id, 'Terugboeking: bestelling geannuleerd of terugbetaald')
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  UPDATE customer_loyalty
     SET points_balance = points_balance - e.points,
         points_earned_total = greatest(0, points_earned_total - e.points),
         last_activity_at = now()
   WHERE id = e.customer_loyalty_id;
  PERFORM loyalty_recompute_tier(e.customer_loyalty_id);
  RETURN e.points;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_orders_loyalty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Fouten in het puntensysteem mogen een order nooit blokkeren.
  BEGIN
    IF NEW.payment_status::text = 'paid'
       AND (TG_OP = 'INSERT' OR OLD.payment_status::text IS DISTINCT FROM 'paid') THEN
      PERFORM loyalty_award_for_order(NEW.id);
    END IF;
    IF TG_OP = 'UPDATE'
       AND (NEW.status::text IN ('cancelled', 'refunded') OR NEW.payment_status::text = 'refunded')
       AND (OLD.status::text IS DISTINCT FROM NEW.status::text OR OLD.payment_status::text IS DISTINCT FROM NEW.payment_status::text) THEN
      PERFORM loyalty_reverse_for_order(NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'loyalty trigger failed for order %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_orders_loyalty ON public.orders;
CREATE TRIGGER trg_orders_loyalty
  AFTER INSERT OR UPDATE OF payment_status, status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_loyalty();

REVOKE ALL ON FUNCTION public.loyalty_award_for_order(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_reverse_for_order(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.loyalty_recompute_tier(uuid) FROM public, anon, authenticated;
