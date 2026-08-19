CREATE OR REPLACE FUNCTION public.get_event_ticket_counts(p_event_detail_ids uuid[])
RETURNS TABLE(event_detail_id uuid, product_id uuid, sold int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT t.event_detail_id, t.product_id, COUNT(*)::int
  FROM public.ticket_instances t
  WHERE t.event_detail_id = ANY(p_event_detail_ids)
    AND t.status IN ('valid','checked_in')
  GROUP BY 1, 2
$function$;

REVOKE ALL ON FUNCTION public.get_event_ticket_counts(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_event_ticket_counts(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.get_event_ticket_counts(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_ticket_counts(uuid[]) TO service_role;