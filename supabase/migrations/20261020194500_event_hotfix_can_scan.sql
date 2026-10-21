-- EVENT-HOTFIX (2026-10-20)
-- 1. Status 'confirmed' blokkeerde elke binnenkomst aan de deur (event_not_active).
--    Binnenkomst mag nu bij 'scheduled' én 'confirmed'.
-- 2. Heringang "1x per dag" rekende per UTC-dag. Nu per lokale eventnacht in de
--    tijdzone van het event, met de dag die om 06:00 wisselt (een crawl van 20:00
--    tot 03:00 is één dag).
-- Snapshot van de vorige definitie: snapshots.functions_20261020_event_hotfix.
CREATE OR REPLACE FUNCTION public.can_scan(p_ticket_id uuid, p_event_detail_id uuid, p_zone_id uuid, p_direction text, p_scanner_access_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket public.ticket_instances;
  v_event public.event_details;
  v_zone public.event_zones;
  v_tt public.event_ticket_types;
  v_cnt int;
  v_tz text;
  v_day_start timestamptz;
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
  IF p_direction = 'in' AND v_event.status NOT IN ('scheduled','confirmed') THEN
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
      -- Lokale eventdag in de tijdzone van het event, wisselt om 06:00.
      v_tz := COALESCE(NULLIF(v_event.timezone, ''), 'Europe/Brussels');
      v_day_start := (date_trunc('day', (now() AT TIME ZONE v_tz) - interval '6 hours') + interval '6 hours') AT TIME ZONE v_tz;
      SELECT COUNT(*) INTO v_cnt FROM public.ticket_scans s
      WHERE s.ticket_instance_id = p_ticket_id AND s.direction = 'in'
        AND s.result IN ('ok','manual_override')
        AND s.scanned_at >= v_day_start;
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
