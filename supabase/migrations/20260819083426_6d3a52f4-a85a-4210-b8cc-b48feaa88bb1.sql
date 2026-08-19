-- EVENT-SYSTEEM FASE 1 (nazorg) — anon-rechten op de vijf nieuwe tabellen intrekken.
-- De project-brede default privileges gaven anon automatisch alle rechten; RLS
-- blokkeerde anon al (geen anon-policy), maar het recht hoort er niet te staan.
REVOKE ALL ON public.event_groups FROM anon;
REVOKE ALL ON public.event_zones FROM anon;
REVOKE ALL ON public.event_ticket_types FROM anon;
REVOKE ALL ON public.event_scanner_access FROM anon;
REVOKE ALL ON public.ticket_scans FROM anon;

-- Nieuwe helper-functies: niet publiek/anoniem uitvoerbaar.
REVOKE ALL ON FUNCTION public.ticket_last_scan(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ticket_is_inside(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.zone_occupancy(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.event_occupancy(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ticket_checkin_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_event_ticket_type_count(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ticket_last_scan(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ticket_is_inside(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.zone_occupancy(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.event_occupancy(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ticket_checkin_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_event_ticket_type_count(uuid, uuid) TO authenticated, service_role;