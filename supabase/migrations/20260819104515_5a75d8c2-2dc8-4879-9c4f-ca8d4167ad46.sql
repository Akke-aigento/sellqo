-- EVENT-SYSTEEM FASE 2a — check-in engine (scan-log + dual-write)

-- 1. ticket_scans.result verruimen met 'event_not_active' (additief)
ALTER TABLE public.ticket_scans DROP CONSTRAINT IF EXISTS ticket_scans_result_check;
ALTER TABLE public.ticket_scans ADD CONSTRAINT ticket_scans_result_check
  CHECK (result IN ('ok','already_inside','not_allowed_zone','wrong_event','invalid',
                    'cancelled','reentry_blocked','zone_full','expired','manual_override',
                    'undo','event_not_active'));

-- 2. occupancy-helpers: 'undo'-rijen meetellen (direction='out' → buiten)
CREATE OR REPLACE FUNCTION public.ticket_is_inside(p_ticket_id uuid, p_zone_id uuid DEFAULT NULL::uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT COALESCE((
    SELECT s.direction = 'in'
    FROM public.ticket_scans s
    WHERE s.ticket_instance_id = p_ticket_id
      AND s.result IN ('ok','manual_override','undo')
      AND (p_zone_id IS NULL OR s.zone_id = p_zone_id)
    ORDER BY s.scanned_at DESC, s.id DESC
    LIMIT 1
  ), false)
$function$;

CREATE OR REPLACE FUNCTION public.zone_occupancy(p_zone_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT COUNT(*)::int FROM (
    SELECT DISTINCT ON (s.ticket_instance_id) s.direction
    FROM public.ticket_scans s
    WHERE s.zone_id = p_zone_id
      AND s.result IN ('ok','manual_override','undo')
    ORDER BY s.ticket_instance_id, s.scanned_at DESC, s.id DESC
  ) last_per_ticket
  WHERE direction = 'in'
$function$;

-- 3. can_scan — puur beslissing, read-only
CREATE OR REPLACE FUNCTION public.can_scan(
  p_ticket_id uuid,
  p_event_detail_id uuid,
  p_zone_id uuid,
  p_direction text,
  p_scanner_access_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_ticket public.ticket_instances;
  v_event public.event_details;
  v_zone public.event_zones;
  v_tt public.event_ticket_types;
  v_cnt int;
BEGIN
  SELECT * INTO v_ticket FROM public.ticket_instances WHERE id = p_ticket_id;
  IF v_ticket.id IS NULL THEN
    RETURN jsonb_build_object('result','invalid','reason','unknown_token');
  END IF;

  SELECT * INTO v_event FROM public.event_details WHERE id = p_event_detail_id;
  IF v_event.id IS NULL OR v_event.tenant_id <> v_ticket.tenant_id THEN
    RETURN jsonb_build_object('result','invalid','reason','unknown_token');
  END IF;

  -- Event-status blokkeert ALLEEN binnenkomst; opschonen (out/undo) blijft mogelijk.
  IF p_direction = 'in' AND v_event.status <> 'scheduled' THEN
    RETURN jsonb_build_object('result','event_not_active','reason', v_event.status);
  END IF;

  IF v_ticket.event_detail_id <> p_event_detail_id THEN
    RETURN jsonb_build_object('result','wrong_event');
  END IF;

  IF v_ticket.status IN ('cancelled','refunded','transferred') THEN
    RETURN jsonb_build_object('result','invalid','reason','ticket_' || v_ticket.status);
  END IF;

  -- Tickettype voor dit ticket (product + event)
  SELECT * INTO v_tt
  FROM public.event_ticket_types t
  WHERE t.event_detail_id = p_event_detail_id
    AND t.product_id = v_ticket.product_id
  LIMIT 1;

  -- Zone-toegang
  IF v_tt.id IS NOT NULL AND v_tt.zone_ids IS NOT NULL AND array_length(v_tt.zone_ids, 1) > 0 THEN
    IF p_zone_id IS NULL OR NOT (p_zone_id = ANY (v_tt.zone_ids)) THEN
      RETURN jsonb_build_object('result','not_allowed_zone');
    END IF;
  END IF;

  IF p_direction = 'in' THEN
    -- Re-entry
    IF COALESCE(v_tt.reentry_policy, 'none') = 'none' THEN
      IF public.ticket_is_inside(p_ticket_id, p_zone_id) THEN
        RETURN jsonb_build_object('result','already_inside');
      END IF;
    ELSIF v_tt.reentry_policy = 'once_per_day' THEN
      SELECT COUNT(*) INTO v_cnt FROM public.ticket_scans s
      WHERE s.ticket_instance_id = p_ticket_id AND s.direction = 'in'
        AND s.result IN ('ok','manual_override')
        AND s.scanned_at >= date_trunc('day', now());
      IF v_cnt > 0 THEN RETURN jsonb_build_object('result','reentry_blocked'); END IF;
    ELSIF v_tt.reentry_policy = 'once_per_event' THEN
      SELECT COUNT(*) INTO v_cnt FROM public.ticket_scans s
      WHERE s.ticket_instance_id = p_ticket_id AND s.direction = 'in'
        AND s.result IN ('ok','manual_override');
      IF v_cnt > 0 THEN RETURN jsonb_build_object('result','reentry_blocked'); END IF;
    END IF;

    -- Zone-capaciteit
    IF p_zone_id IS NOT NULL THEN
      SELECT * INTO v_zone FROM public.event_zones WHERE id = p_zone_id;
      IF v_zone.capacity IS NOT NULL AND public.zone_occupancy(p_zone_id) >= v_zone.capacity THEN
        RETURN jsonb_build_object('result','zone_full');
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('result','ok');
END;
$function$;

-- 4. perform_scan — atomic beslissen + schrijven (scan-log leidend, status dual-write)
CREATE OR REPLACE FUNCTION public.perform_scan(
  p_ticket_id uuid,
  p_event_detail_id uuid,
  p_zone_id uuid,
  p_direction text,
  p_scanner_access_id uuid DEFAULT NULL,
  p_scanned_by_user_id uuid DEFAULT NULL,
  p_device_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_decision jsonb;
  v_result text;
  v_reason text;
  v_ticket public.ticket_instances;
  v_updated public.ticket_instances;
  v_checked_in_at timestamptz;
BEGIN
  v_decision := public.can_scan(p_ticket_id, p_event_detail_id, p_zone_id, p_direction, p_scanner_access_id);
  v_result := v_decision->>'result';
  v_reason := v_decision->>'reason';

  SELECT * INTO v_ticket FROM public.ticket_instances WHERE id = p_ticket_id;

  -- Onbekend ticket: geen scan-rij mogelijk (FK), enkel beslissing terug.
  IF v_ticket.id IS NULL THEN
    RETURN v_decision;
  END IF;

  IF v_result = 'ok' AND p_direction = 'in' THEN
    UPDATE public.ticket_instances
       SET status = 'checked_in',
           checked_in_at = now(),
           checked_in_by = p_scanned_by_user_id
     WHERE id = p_ticket_id AND status = 'valid'
    RETURNING * INTO v_updated;

    IF v_updated.id IS NULL THEN
      -- Race verloren: andere scanner won.
      v_result := 'already_inside';
      SELECT checked_in_at INTO v_checked_in_at FROM public.ticket_instances WHERE id = p_ticket_id;
    ELSE
      v_checked_in_at := v_updated.checked_in_at;
    END IF;
  END IF;

  INSERT INTO public.ticket_scans (
    tenant_id, ticket_instance_id, event_detail_id, zone_id, scanner_access_id,
    scanned_by_user_id, direction, result, device_id, note
  ) VALUES (
    v_ticket.tenant_id, p_ticket_id, p_event_detail_id, p_zone_id, p_scanner_access_id,
    p_scanned_by_user_id, p_direction, v_result, p_device_id, v_reason
  );

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'result', v_result,
    'reason', v_reason,
    'attendee', v_ticket.attendee_name,
    'seq', v_ticket.seq,
    'checked_in_at', v_checked_in_at
  ));
END;
$function$;

REVOKE ALL ON FUNCTION public.can_scan(uuid,uuid,uuid,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.perform_scan(uuid,uuid,uuid,text,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_scan(uuid,uuid,uuid,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.perform_scan(uuid,uuid,uuid,text,uuid,uuid,text) TO service_role;