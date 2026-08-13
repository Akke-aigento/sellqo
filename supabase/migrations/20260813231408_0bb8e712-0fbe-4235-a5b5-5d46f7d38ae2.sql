REVOKE ALL ON public.event_details FROM anon;
REVOKE ALL ON public.ticket_instances FROM anon;
REVOKE ALL ON public.ticket_change_tokens FROM anon;
REVOKE ALL ON public.ticket_change_tokens FROM authenticated;
REVOKE ALL ON public.ticket_instances FROM authenticated;
GRANT SELECT, UPDATE ON public.ticket_instances TO authenticated;
REVOKE TRIGGER, TRUNCATE, REFERENCES ON public.event_details FROM authenticated;