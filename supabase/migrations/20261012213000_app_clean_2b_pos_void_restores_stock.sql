-- APP-CLEAN-2b (12-10-2026) — een geannuleerde (voided) kassaverkoop zet de voorraad terug.
--
-- handle_pos_transaction_stock boekt voorraad af bij status 'completed'.
-- handle_pos_refund_stock zette alleen terug bij 'refunded'. Een void liet de
-- voorraad dus te laag staan (gevonden bij de VanXcel-testverkoop van 16-03-2026).
--
-- Nu: terugzetten bij 'refunded' (zoals voorheen) én bij 'voided' vanuit
-- 'completed'. Nooit dubbel: geen terugzetting bij refunded→voided of
-- voided→refunded, want de eerste overgang heeft het al gedaan.

CREATE OR REPLACE FUNCTION public.handle_pos_refund_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
BEGIN
  IF (NEW.status = 'refunded' AND OLD.status NOT IN ('refunded', 'voided'))
     OR (NEW.status = 'voided' AND OLD.status = 'completed') THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) AS i
    LOOP
      UPDATE public.products
         SET stock = stock + (item.value->>'quantity')::INTEGER
       WHERE id = (item.value->>'product_id')::UUID
         AND track_inventory = true;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;
