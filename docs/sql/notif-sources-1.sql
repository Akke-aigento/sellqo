-- NOTIF-SOURCES-1 — één bron per bestelmelding + payout-dedup.
--
-- BEWUST GEEN MIGRATIE: chat-Claude voert dit uit via de connector.
-- Idempotent: CREATE OR REPLACE en CREATE ... IF NOT EXISTS.
-- Bevat geen keys of tokens (gescand op het JWT-prefix vóór commit).
--
-- Volgorde: (0) snapshot bewaren, (1) droogtest, (2) functie, (3) index, (4) controle.

-- ─────────────────────────────────────────────────────────────────────
-- (0) SNAPSHOT — bewaar de uitvoer; dat is de terugdraai.
-- ─────────────────────────────────────────────────────────────────────
SELECT pg_get_functiondef('public.handle_order_notification'::regproc) AS snapshot_handle_order_notification;

-- Terugdraaien: de snapshot hierboven opnieuw uitvoeren, en
--   DROP INDEX IF EXISTS public.notifications_payout_once;
-- Ter referentie de live definitie van 19-09-2026, ongewijzigd behalve het
-- blok "Nieuwe bestelling" (zie (2)):
--
--   IF (TG_OP = 'INSERT' AND NEW.payment_status = 'paid')
--      OR (TG_OP = 'UPDATE' AND NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid') THEN
--     v_type := 'order_new';
--     v_title := 'Nieuwe bestelling: ' || NEW.order_number;
--     v_message := 'Bestelling ' || NEW.order_number || ' van €' || ROUND(NEW.total::numeric, 2) || ' is ontvangen';
--     ... order_high_value ... send_notification(..., jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'total', NEW.total));

-- ─────────────────────────────────────────────────────────────────────
-- (1) DROOGTEST — welk type de nieuwe functie per soort order zou kiezen.
-- Geen testorders in productie (keuze Akke, 19-09). Verwacht: bol_com →
-- marketplace_order_new; web / shopify / shopify_draft_order / <null> → order_new.
-- ─────────────────────────────────────────────────────────────────────
SELECT coalesce(marketplace_source, '<null>') AS marketplace_source,
       CASE WHEN marketplace_source IN ('bol_com') THEN 'marketplace_order_new' ELSE 'order_new' END AS type_na_fix,
       count(*) AS orders
FROM public.orders
GROUP BY 1, 2
ORDER BY 3 DESC;

-- ─────────────────────────────────────────────────────────────────────
-- (2) handle_order_notification — de trigger is de enige bron van de
-- "nieuwe bestelling"-melding.
--
-- Waarom: elke webshop-order kreeg order_new (deze trigger) én ~9 s later
-- storefront_order_new (storefront-api / stripe-connect-webhook); elke
-- Bol-order order_new én marketplace_order_new (sync-bol-orders). Die edge-
-- meldingen zijn in dezelfde commit weggehaald. Voor Bol maakt de trigger nu
-- zelf marketplace_order_new (keuze Akke): marketplace_source 'bol_com' wordt
-- ook door import-bol-csv en import-bol-shipments geschreven, en geen kolom
-- onderscheidt ze — zo krijgt élke Bol-order precies één melding, en blijven de
-- bestaande voorkeuren voor marketplace_order_new werken. Alleen 'bol_com'
-- staat in de lijst; andere marketplaces houden order_new.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_order_notification()
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
  v_data JSONB;
BEGIN
  v_action_url := '/admin/orders/' || NEW.id;

  -- Nieuwe bestelling: alleen notificatie als payment_status = 'paid'
  IF (TG_OP = 'INSERT' AND NEW.payment_status = 'paid')
     OR (TG_OP = 'UPDATE' AND NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid') THEN

    -- NOTIF-SOURCES-1: Bol-orders krijgen het Bol-type, alle andere order_new.
    IF NEW.marketplace_source IN ('bol_com') THEN
      v_type := 'marketplace_order_new';
      v_title := 'Bol.com bestelling: ' || NEW.order_number;
      v_message := 'Nieuwe Bol.com bestelling van €' || ROUND(NEW.total::numeric, 2) || ' ontvangen';
      v_data := jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'total', NEW.total,
        'marketplace', NEW.marketplace_source,
        'marketplace_order_id', NEW.marketplace_order_id
      );
    ELSE
      v_type := 'order_new';
      v_title := 'Nieuwe bestelling: ' || NEW.order_number;
      v_message := 'Bestelling ' || NEW.order_number || ' van €' || ROUND(NEW.total::numeric, 2) || ' is ontvangen';
      v_data := jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'total', NEW.total);
    END IF;
    v_priority := 'medium';

    -- High value order (> €500)
    IF NEW.total > 500 THEN
      PERFORM public.send_notification(
        NEW.tenant_id,
        'orders',
        'order_high_value',
        'Grote bestelling ontvangen: ' || NEW.order_number,
        'Bestelling ' || NEW.order_number || ' heeft een waarde van €' || ROUND(NEW.total::numeric, 2),
        'high',
        v_action_url,
        jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'total', NEW.total)
      );
    END IF;

    PERFORM public.send_notification(
      NEW.tenant_id,
      'orders',
      v_type,
      v_title,
      v_message,
      v_priority,
      v_action_url,
      v_data
    );

  -- Order status updates (cancelled, shipped, delivered) blijven werken zoals voorheen
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'cancelled' THEN
        v_type := 'order_cancelled';
        v_title := 'Bestelling geannuleerd: ' || NEW.order_number;
        v_message := 'Bestelling ' || NEW.order_number || ' is geannuleerd';
        v_priority := 'high';

      WHEN 'shipped' THEN
        v_type := 'order_shipped';
        v_title := 'Bestelling verzonden: ' || NEW.order_number;
        v_message := 'Bestelling ' || NEW.order_number || ' is verzonden';
        v_priority := 'low';

      WHEN 'delivered' THEN
        v_type := 'order_delivered';
        v_title := 'Bestelling afgeleverd: ' || NEW.order_number;
        v_message := 'Bestelling ' || NEW.order_number || ' is succesvol afgeleverd';
        v_priority := 'low';

      ELSE
        RETURN NEW;
    END CASE;

    PERFORM public.send_notification(
      NEW.tenant_id,
      'orders',
      v_type,
      v_title,
      v_message,
      v_priority,
      v_action_url,
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'status', NEW.status, 'previous_status', OLD.status)
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- (3) Payout-dedup: platform-stripe-webhook en stripe-connect-webhook
-- verwerken allebei payout.*; de helper _shared/payoutNotification.ts checkt
-- vooraf, deze index vangt de race. create-notification behandelt 23505 als
-- duplicaat. Live 19-09: 0 rijen met payout_id, dus geen conflict.
-- ─────────────────────────────────────────────────────────────────────
SELECT count(*) AS bestaande_payout_rijen,
       count(*) - count(DISTINCT (data->>'payout_id', type)) AS duplicaten
FROM public.notifications WHERE data ? 'payout_id';

CREATE UNIQUE INDEX IF NOT EXISTS notifications_payout_once
  ON public.notifications ((data->>'payout_id'), type)
  WHERE data ? 'payout_id';

-- ─────────────────────────────────────────────────────────────────────
-- (4) CONTROLE
-- ─────────────────────────────────────────────────────────────────────
SELECT position('marketplace_order_new' IN pg_get_functiondef('public.handle_order_notification'::regproc)) > 0 AS bol_tak_actief;
SELECT indexname FROM pg_indexes WHERE indexname = 'notifications_payout_once';
