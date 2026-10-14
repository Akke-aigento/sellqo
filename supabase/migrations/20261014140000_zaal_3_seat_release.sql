-- ZAAL-3 — stoelen terug vrij en per voorstelling blokkeren. Strikt additief.
--  - Een ticket dat geannuleerd of terugbetaald wordt (of verdwijnt) geeft zijn stoel vrij.
--    De WHEN-voorwaarde zorgt dat de functie enkel draait voor tickets mét stoel; een
--    gewone check-in (valid → checked_in) raakt deze trigger niet.
--  - set_event_seats_blocked: admin zet vrije stoelen van één datum uit/aan de verkoop
--    (bv. techniektafel voor één show). De capaciteit volgt mee.

CREATE OR REPLACE FUNCTION public.release_event_seat_for_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
BEGIN
  UPDATE public.event_seats
     SET status = 'available', ticket_instance_id = NULL, order_id = NULL,
         hold_cart_id = NULL, hold_expires_at = NULL, updated_at = now()
   WHERE ticket_instance_id = v_id;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RAISE WARNING 'release_event_seat_for_ticket failed for ticket %: %', v_id, SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS ticket_instances_release_seat ON public.ticket_instances;
CREATE TRIGGER ticket_instances_release_seat AFTER UPDATE OF status ON public.ticket_instances
  FOR EACH ROW
  WHEN (NEW.seat_label IS NOT NULL AND NEW.status IN ('cancelled', 'refunded') AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.release_event_seat_for_ticket();

DROP TRIGGER IF EXISTS ticket_instances_release_seat_delete ON public.ticket_instances;
CREATE TRIGGER ticket_instances_release_seat_delete AFTER DELETE ON public.ticket_instances
  FOR EACH ROW
  WHEN (OLD.seat_label IS NOT NULL)
  EXECUTE FUNCTION public.release_event_seat_for_ticket();

CREATE OR REPLACE FUNCTION public.set_event_seats_blocked(p_event_detail_id uuid, p_seat_ids uuid[], p_blocked boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ev record;
  v_changed int;
  v_total int;
BEGIN
  SELECT id, tenant_id INTO v_ev FROM public.event_details WHERE id = p_event_detail_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found'; END IF;
  IF NOT (v_ev.tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
          AND public.has_tenant_role(v_ev.tenant_id, ARRAY['tenant_admin'::app_role, 'staff'::app_role])) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_detail_id::text, 0));

  IF p_blocked THEN
    -- Alleen echt vrije stoelen (of verlopen holds zonder order) gaan uit de verkoop.
    UPDATE public.event_seats
       SET status = 'blocked', hold_cart_id = NULL, hold_expires_at = NULL, updated_at = now()
     WHERE event_detail_id = p_event_detail_id AND id = ANY (p_seat_ids) AND ticket_instance_id IS NULL
       AND (status = 'available' OR (status = 'held' AND order_id IS NULL AND hold_expires_at < now()));
  ELSE
    -- Terug in verkoop kan enkel voor een stoel met een tickettype.
    UPDATE public.event_seats
       SET status = 'available', updated_at = now()
     WHERE event_detail_id = p_event_detail_id AND id = ANY (p_seat_ids) AND status = 'blocked' AND product_id IS NOT NULL;
  END IF;
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  SELECT count(*) INTO v_total FROM public.event_seats WHERE event_detail_id = p_event_detail_id AND status <> 'blocked';
  UPDATE public.event_details SET capacity = v_total, updated_at = now() WHERE id = p_event_detail_id;
  UPDATE public.event_ticket_types t
     SET sub_capacity = COALESCE((SELECT count(*)::int FROM public.event_seats s
                                  WHERE s.event_detail_id = p_event_detail_id AND s.product_id = t.product_id AND s.status <> 'blocked'), 0)
   WHERE t.event_detail_id = p_event_detail_id;

  RETURN jsonb_build_object('ok', true, 'changed', v_changed, 'capacity', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.set_event_seats_blocked(uuid, uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_event_seats_blocked(uuid, uuid[], boolean) TO authenticated, service_role;
