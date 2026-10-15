-- DISCOUNT-LIMIT-1 (15-10-2026) — gebruik van kortingscodes vastleggen bij betaling.
--
-- Probleem: discount_code_usage bleef leeg (niemand schreef erin), usage_count telde al op
-- bij een nog niet betaalde overschrijving, en het Stripe-pad telde nooit. Daardoor werd
-- "x keer per klant" nergens afgedwongen.
--
-- Oplossing: één trigger op orders, voor ELK pad dat een order betaald zet (Stripe-webhook,
-- checkout_verify_payment, overschrijving via admin of bankafstemming, gratis order):
--   * order telt (payment_status paid/partially_refunded en status <> cancelled) en draagt
--     een code → per code één rij in discount_code_usage (uniek per code+order) en
--     usage_count +1, alleen als de rij nieuw is (idempotent);
--   * order telt niet meer (cancelled, refunded, failed) → rijen van die order weg en
--     usage_count -1 per verwijderde rij (nooit onder 0).
-- Een fout in de trigger blokkeert nooit de order (zelfde patroon als trg_orders_loyalty).
--
-- Additief: nieuwe unieke index, nieuwe functie, nieuwe trigger. Geen bestaande kolom,
-- policy of functie gewijzigd. increment_discount_usage blijft bestaan (niet meer
-- aangeroepen door storefront-api).
--
-- Terugdraaien (handmatig):
--   DROP TRIGGER IF EXISTS trg_orders_discount_usage ON public.orders;
--   DROP FUNCTION IF EXISTS public.trg_orders_discount_usage();
--   DROP INDEX IF EXISTS public.uq_discount_code_usage_code_order;
--   -- en storefront-api terugzetten naar de vorige versie (die riep increment_discount_usage aan).

CREATE UNIQUE INDEX IF NOT EXISTS uq_discount_code_usage_code_order
  ON public.discount_code_usage (discount_code_id, order_id);

CREATE OR REPLACE FUNCTION public.trg_orders_discount_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_counts boolean;
  v_code text;
  v_dc_id uuid;
  v_first boolean := true;
  v_inserted integer;
  r record;
BEGIN
  BEGIN
    v_counts := NEW.payment_status::text IN ('paid', 'partially_refunded')
                AND COALESCE(NEW.status::text, '') <> 'cancelled';

    IF v_counts AND NULLIF(btrim(COALESCE(NEW.discount_code, '')), '') IS NOT NULL THEN
      -- orders.discount_code is "A" of "A, B" (storefront-api / stripe-connect-webhook).
      FOR v_code IN
        SELECT upper(btrim(x.c))
        FROM unnest(string_to_array(NEW.discount_code, ',')) WITH ORDINALITY AS x(c, ord)
        WHERE btrim(x.c) <> ''
        GROUP BY upper(btrim(x.c))
        ORDER BY min(x.ord)
      LOOP
        SELECT id INTO v_dc_id FROM public.discount_codes
         WHERE tenant_id = NEW.tenant_id AND upper(code) = v_code
         ORDER BY (code = v_code) DESC
         LIMIT 1;
        CONTINUE WHEN v_dc_id IS NULL;

        INSERT INTO public.discount_code_usage (discount_code_id, order_id, customer_email, discount_amount)
        VALUES (
          v_dc_id, NEW.id, lower(btrim(COALESCE(NEW.customer_email, ''))),
          -- Bij meerdere codes is het orderbedrag niet per code te splitsen: de eerste code
          -- krijgt het hele kortingsbedrag, de rest 0 (zo telt een som niet dubbel).
          CASE WHEN v_first THEN COALESCE(NEW.discount_amount, 0) ELSE 0 END
        )
        ON CONFLICT (discount_code_id, order_id) DO NOTHING;
        GET DIAGNOSTICS v_inserted = ROW_COUNT;
        v_first := false;

        IF v_inserted > 0 THEN
          UPDATE public.discount_codes SET usage_count = usage_count + 1 WHERE id = v_dc_id;
        END IF;
      END LOOP;

    ELSIF TG_OP = 'UPDATE' AND NOT v_counts THEN
      FOR r IN
        DELETE FROM public.discount_code_usage WHERE order_id = NEW.id RETURNING discount_code_id
      LOOP
        UPDATE public.discount_codes SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = r.discount_code_id;
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'discount usage trigger failed for order %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_orders_discount_usage() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_orders_discount_usage ON public.orders;
CREATE TRIGGER trg_orders_discount_usage
  AFTER INSERT OR UPDATE OF payment_status, status, discount_code ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_discount_usage();
