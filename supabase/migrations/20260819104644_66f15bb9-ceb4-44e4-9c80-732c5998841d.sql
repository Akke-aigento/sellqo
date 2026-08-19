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
      v_result := 'already_inside';
    ELSE
      v_checked_in_at := v_updated.checked_in_at;
    END IF;
  END IF;

  -- COMPAT: de scanner-app toont bij 'already_inside' het bestaande tijdstip.
  IF v_result = 'already_inside' AND v_checked_in_at IS NULL THEN
    SELECT checked_in_at INTO v_checked_in_at FROM public.ticket_instances WHERE id = p_ticket_id;
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

REVOKE ALL ON FUNCTION public.perform_scan(uuid,uuid,uuid,text,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perform_scan(uuid,uuid,uuid,text,uuid,uuid,text) TO service_role;