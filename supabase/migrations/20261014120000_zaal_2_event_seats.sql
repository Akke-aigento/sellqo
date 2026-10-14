-- ZAAL-2 — stoelen per datum. Strikt additief: enkel datums waaraan een zaal gekoppeld
-- is (event_details.venue_id + rijen in event_seats) krijgen stoelkeuze. Alle andere
-- datums (Fonske, VanXcel, Mancini…) blijven exact zoals ze zijn.
--
--  - event_details.venue_id: welke zaal (ON DELETE SET NULL; het plan per datum is een kopie);
--  - event_seats: kopie van het stoelplan bij het koppelen, met per stoel het tickettype
--    (product_id) en de status available / held / sold / blocked;
--  - link_event_venue / unlink_event_venue: admin (tenant_admin of staff), via RLS-predicaat;
--  - hold_event_seats / release_cart_seats: enkel service_role (storefront-api);
--  - trigger op ticket_instances: geeft elk nieuw ticket zijn stoel (seat_label) en zet
--    die stoel op sold. issue_tickets_for_order zelf blijft onaangeroerd.

ALTER TABLE public.event_details
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.event_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_detail_id uuid NOT NULL REFERENCES public.event_details(id) ON DELETE CASCADE,
  venue_seat_id uuid,
  section_name text NOT NULL,
  row_label text NOT NULL,
  seat_number text NOT NULL,
  x integer NOT NULL,
  y integer NOT NULL,
  kind text NOT NULL DEFAULT 'seat' CHECK (kind IN ('seat', 'wheelchair', 'companion')),
  class_name text,
  color text NOT NULL DEFAULT '#94A3B8',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'held', 'sold', 'blocked')),
  hold_cart_id uuid,
  hold_expires_at timestamptz,
  order_id uuid,
  ticket_instance_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_seats_position_unique UNIQUE (event_detail_id, x, y),
  CONSTRAINT event_seats_label_unique UNIQUE (event_detail_id, section_name, row_label, seat_number)
);
CREATE INDEX IF NOT EXISTS idx_event_seats_event ON public.event_seats (event_detail_id);
CREATE INDEX IF NOT EXISTS idx_event_seats_cart ON public.event_seats (hold_cart_id) WHERE hold_cart_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_seats_order ON public.event_seats (order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_seats_ticket ON public.event_seats (ticket_instance_id) WHERE ticket_instance_id IS NOT NULL;

GRANT SELECT, UPDATE ON public.event_seats TO authenticated;
GRANT ALL ON public.event_seats TO service_role;
ALTER TABLE public.event_seats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_seats_select_tenant ON public.event_seats;
DROP POLICY IF EXISTS event_seats_update_tenant ON public.event_seats;
CREATE POLICY event_seats_select_tenant ON public.event_seats FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));
CREATE POLICY event_seats_update_tenant ON public.event_seats FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role]));

-- ── Koppelen ─────────────────────────────────────────────────────────────────
-- p_mapping: {"<venue_price_class_id>": "<product_id>", …}. Elk product moet het
-- hoofdproduct van de datum zijn of een tickettype van deze datum. Stoelen zonder
-- prijsklasse of zonder koppeling worden 'blocked'.
CREATE OR REPLACE FUNCTION public.link_event_venue(p_event_detail_id uuid, p_venue_id uuid, p_mapping jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ev record;
  v_venue record;
  v_bad int;
  v_total int;
  v_counts jsonb;
BEGIN
  SELECT id, tenant_id, product_id INTO v_ev FROM public.event_details WHERE id = p_event_detail_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found'; END IF;
  IF NOT (v_ev.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
          AND public.has_tenant_role(v_ev.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role])) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  SELECT id, tenant_id INTO v_venue FROM public.venues WHERE id = p_venue_id AND tenant_id = v_ev.tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'venue_not_found'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_detail_id::text, 0));

  IF EXISTS (SELECT 1 FROM public.ticket_instances WHERE event_detail_id = p_event_detail_id AND status IN ('valid', 'checked_in')) THEN
    RAISE EXCEPTION 'date_has_tickets';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_seats WHERE event_detail_id = p_event_detail_id AND status IN ('held', 'sold')) THEN
    RAISE EXCEPTION 'date_has_seat_activity';
  END IF;

  -- Elk gekozen product moet bij deze datum horen.
  SELECT count(*) INTO v_bad
  FROM jsonb_each_text(COALESCE(p_mapping, '{}'::jsonb)) m
  WHERE m.value::uuid IS DISTINCT FROM v_ev.product_id
    AND NOT EXISTS (SELECT 1 FROM public.event_ticket_types t
                    WHERE t.event_detail_id = p_event_detail_id AND t.product_id = m.value::uuid);
  IF v_bad > 0 THEN RAISE EXCEPTION 'product_not_on_date'; END IF;

  DELETE FROM public.event_seats WHERE event_detail_id = p_event_detail_id;

  INSERT INTO public.event_seats (tenant_id, event_detail_id, venue_seat_id, section_name, row_label, seat_number,
                                  x, y, kind, class_name, color, product_id, status)
  SELECT v_ev.tenant_id, p_event_detail_id, s.id, sec.name, s.row_label, s.seat_number, s.x, s.y, s.kind,
         pc.name, COALESCE(pc.color, '#94A3B8'),
         (p_mapping ->> s.price_class_id::text)::uuid,
         CASE WHEN s.sellable AND (p_mapping ->> s.price_class_id::text) IS NOT NULL THEN 'available' ELSE 'blocked' END
  FROM public.venue_seats s
  JOIN public.venue_sections sec ON sec.id = s.section_id
  LEFT JOIN public.venue_price_classes pc ON pc.id = s.price_class_id
  WHERE s.venue_id = p_venue_id;

  SELECT count(*) INTO v_total FROM public.event_seats WHERE event_detail_id = p_event_detail_id AND status = 'available';
  IF v_total = 0 THEN RAISE EXCEPTION 'no_sellable_seats'; END IF;

  -- Capaciteit volgt de stoelen: per tickettype en voor de hele datum.
  UPDATE public.event_details SET venue_id = p_venue_id, capacity = v_total, updated_at = now() WHERE id = p_event_detail_id;
  UPDATE public.event_ticket_types t
     SET sub_capacity = c.n
    FROM (SELECT product_id, count(*)::int n FROM public.event_seats
          WHERE event_detail_id = p_event_detail_id AND status = 'available' GROUP BY product_id) c
   WHERE t.event_detail_id = p_event_detail_id AND t.product_id = c.product_id;
  -- Een tickettype van deze datum zonder stoelen kan niet meer verkocht worden.
  UPDATE public.event_ticket_types t SET sub_capacity = 0
   WHERE t.event_detail_id = p_event_detail_id
     AND NOT EXISTS (SELECT 1 FROM public.event_seats s WHERE s.event_detail_id = p_event_detail_id
                     AND s.product_id = t.product_id AND s.status = 'available');

  SELECT jsonb_object_agg(product_id::text, n) INTO v_counts
  FROM (SELECT product_id, count(*) n FROM public.event_seats
        WHERE event_detail_id = p_event_detail_id AND status = 'available' GROUP BY product_id) q;
  RETURN jsonb_build_object('ok', true, 'seats', v_total, 'per_product', COALESCE(v_counts, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.unlink_event_venue(p_event_detail_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ev record;
BEGIN
  SELECT id, tenant_id INTO v_ev FROM public.event_details WHERE id = p_event_detail_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found'; END IF;
  IF NOT (v_ev.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
          AND public.has_tenant_role(v_ev.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role])) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_detail_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.event_seats WHERE event_detail_id = p_event_detail_id
             AND (status = 'sold' OR (status = 'held' AND (hold_expires_at IS NULL OR hold_expires_at > now())))) THEN
    RAISE EXCEPTION 'date_has_seat_activity';
  END IF;
  DELETE FROM public.event_seats WHERE event_detail_id = p_event_detail_id;
  UPDATE public.event_details SET venue_id = NULL, updated_at = now() WHERE id = p_event_detail_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── Vasthouden (storefront-api, service_role) ────────────────────────────────
-- Zet de selectie van een cart voor één datum op exact p_seat_ids. Alles of niets:
-- is één stoel niet vrij, dan verandert er niets en komt de lijst terug.
CREATE OR REPLACE FUNCTION public.hold_event_seats(p_cart_id uuid, p_event_detail_id uuid, p_seat_ids uuid[], p_minutes integer DEFAULT 15)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids uuid[] := COALESCE(p_seat_ids, '{}'::uuid[]);
  v_unavailable uuid[];
BEGIN
  IF array_length(v_ids, 1) > 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many_seats');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_detail_id::text, 0));

  SELECT array_agg(r.id) INTO v_unavailable
  FROM unnest(v_ids) AS r(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_seats s
    WHERE s.id = r.id AND s.event_detail_id = p_event_detail_id
      AND s.product_id IS NOT NULL AND s.ticket_instance_id IS NULL
      AND (s.status = 'available'
           OR (s.status = 'held' AND s.order_id IS NULL AND s.hold_cart_id = p_cart_id)
           OR (s.status = 'held' AND s.hold_expires_at IS NOT NULL AND s.hold_expires_at < now()))
  );
  IF v_unavailable IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'seats_unavailable', 'seat_ids', to_jsonb(v_unavailable));
  END IF;

  UPDATE public.event_seats
     SET status = 'available', hold_cart_id = NULL, hold_expires_at = NULL, updated_at = now()
   WHERE event_detail_id = p_event_detail_id AND hold_cart_id = p_cart_id AND status = 'held'
     AND order_id IS NULL AND NOT (id = ANY (v_ids));

  UPDATE public.event_seats
     SET status = 'held', hold_cart_id = p_cart_id, order_id = NULL,
         hold_expires_at = now() + make_interval(mins => GREATEST(1, LEAST(COALESCE(p_minutes, 15), 60))),
         updated_at = now()
   WHERE id = ANY (v_ids) AND event_detail_id = p_event_detail_id;

  RETURN jsonb_build_object('ok', true, 'held', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', id, 'product_id', product_id)) FROM public.event_seats
    WHERE id = ANY (v_ids)), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.release_cart_seats(p_cart_id uuid, p_event_detail_id uuid DEFAULT NULL, p_product_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH r AS (
    UPDATE public.event_seats
       SET status = 'available', hold_cart_id = NULL, hold_expires_at = NULL, updated_at = now()
     WHERE hold_cart_id = p_cart_id AND status = 'held' AND order_id IS NULL AND ticket_instance_id IS NULL
       AND (p_event_detail_id IS NULL OR event_detail_id = p_event_detail_id)
       AND (p_product_id IS NULL OR product_id = p_product_id)
    RETURNING 1)
  SELECT count(*)::int FROM r;
$$;

REVOKE ALL ON FUNCTION public.hold_event_seats(uuid, uuid, uuid[], integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_cart_seats(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hold_event_seats(uuid, uuid, uuid[], integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_cart_seats(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.link_event_venue(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unlink_event_venue(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_event_venue(uuid, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unlink_event_venue(uuid) TO authenticated, service_role;

-- ── Stoel op het ticket ──────────────────────────────────────────────────────
-- AFTER INSERT, zodat een rij die door ON CONFLICT DO NOTHING wegvalt geen stoel opeist.
-- Volgorde: (1) stoelen die deze order vasthoudt (order_id, of de cart van dezelfde
-- Stripe-sessie); (2) anders de eerste vrije stoel van hetzelfde tickettype, gelogd;
-- (3) anders geen stoel, gelogd. Een ticket wordt nooit tegengehouden.
CREATE OR REPLACE FUNCTION public.assign_event_seat_to_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seat record;
  v_session text;
  v_fallback boolean := false;
  v_admin uuid;
  v_label text;
BEGIN
  IF NEW.event_detail_id IS NULL OR NEW.seat_label IS NOT NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_seats WHERE event_detail_id = NEW.event_detail_id) THEN RETURN NULL; END IF;

  SELECT stripe_checkout_session_id INTO v_session FROM public.orders WHERE id = NEW.order_id;

  SELECT s.* INTO v_seat FROM public.event_seats s
   WHERE s.event_detail_id = NEW.event_detail_id
     AND s.product_id IS NOT DISTINCT FROM NEW.product_id
     AND s.status = 'held' AND s.ticket_instance_id IS NULL
     AND (s.order_id = NEW.order_id
          OR (v_session IS NOT NULL AND s.order_id IS NULL AND s.hold_cart_id IN
              (SELECT c.id FROM public.storefront_carts c WHERE c.stripe_session_id = v_session)))
   ORDER BY s.y, s.x
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    v_fallback := true;
    SELECT s.* INTO v_seat FROM public.event_seats s
     WHERE s.event_detail_id = NEW.event_detail_id
       AND s.product_id IS NOT DISTINCT FROM NEW.product_id
       AND s.ticket_instance_id IS NULL
       AND (s.status = 'available' OR (s.status = 'held' AND s.hold_expires_at IS NOT NULL AND s.hold_expires_at < now()))
     ORDER BY s.y, s.x
     LIMIT 1
     FOR UPDATE;
  END IF;

  IF FOUND THEN
    v_label := v_seat.section_name || ' · ' || v_seat.row_label || ' ' || v_seat.seat_number;
    UPDATE public.event_seats
       SET status = 'sold', ticket_instance_id = NEW.id, order_id = NEW.order_id,
           hold_expires_at = NULL, updated_at = now()
     WHERE id = v_seat.id;
    UPDATE public.ticket_instances SET seat_label = v_label WHERE id = NEW.id;
  END IF;

  IF v_fallback THEN
    SELECT ur.user_id INTO v_admin FROM public.user_roles ur
     WHERE ur.tenant_id = NEW.tenant_id AND ur.role = 'tenant_admin' LIMIT 1;
    IF v_admin IS NULL THEN
      SELECT ur.user_id INTO v_admin FROM public.user_roles ur WHERE ur.role = 'platform_admin' LIMIT 1;
    END IF;
    IF v_admin IS NOT NULL THEN
      INSERT INTO public.admin_actions_log (admin_user_id, target_tenant_id, action_type, action_details)
      VALUES (v_admin, NEW.tenant_id,
              CASE WHEN v_label IS NULL THEN 'ticket_without_seat' ELSE 'ticket_seat_reassigned' END,
              jsonb_build_object('order_id', NEW.order_id, 'event_detail_id', NEW.event_detail_id,
                                 'product_id', NEW.product_id, 'seat', v_label));
    END IF;
  END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN
  -- Een stoelfout mag nooit de uitgifte van een betaald ticket tegenhouden.
  RAISE WARNING 'assign_event_seat_to_ticket failed for ticket %: %', NEW.id, SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS ticket_instances_assign_seat ON public.ticket_instances;
CREATE TRIGGER ticket_instances_assign_seat AFTER INSERT ON public.ticket_instances
  FOR EACH ROW EXECUTE FUNCTION public.assign_event_seat_to_ticket();
