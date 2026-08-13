-- TICKET-1 fase 1: fundament voor event tickets. Strikt additief.
-- Rollback (handmatig): DROP TABLE ticket_change_tokens, ticket_instances, event_details CASCADE;
--                       DROP FUNCTION get_public_events(uuid), get_event_signup_count(uuid);

CREATE TABLE IF NOT EXISTS public.event_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  event_date date NOT NULL,
  start_time time NOT NULL DEFAULT '21:00',
  end_time time NULL,
  meeting_point text NULL,
  location_name text NULL,
  min_attendees int NOT NULL DEFAULT 0,
  capacity int NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','confirmed','cancelled','completed','skipped','merged')),
  merged_into_event_id uuid NULL REFERENCES public.event_details(id),
  timezone text NOT NULL DEFAULT 'Europe/Brussels',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_details_tenant_date ON public.event_details(tenant_id, event_date);
CREATE INDEX IF NOT EXISTS idx_event_details_product ON public.event_details(product_id);

CREATE TABLE IF NOT EXISTS public.ticket_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id),
  event_detail_id uuid NOT NULL REFERENCES public.event_details(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  qr_token text NOT NULL UNIQUE,
  attendee_name text NULL,
  attendee_email text NULL,
  status text NOT NULL DEFAULT 'valid'
    CHECK (status IN ('valid','checked_in','cancelled','refunded')),
  checked_in_at timestamptz NULL,
  checked_in_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_instances_event_status ON public.ticket_instances(event_detail_id, status);
CREATE INDEX IF NOT EXISTS idx_ticket_instances_tenant ON public.ticket_instances(tenant_id);

CREATE TABLE IF NOT EXISTS public.ticket_change_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_instance_id uuid NOT NULL REFERENCES public.ticket_instances(id) ON DELETE CASCADE,
  event_detail_id uuid NOT NULL REFERENCES public.event_details(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  token text NOT NULL UNIQUE,
  choice text NULL CHECK (choice IN ('confirm','refund')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  context jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_change_tokens_instance ON public.ticket_change_tokens(ticket_instance_id);

-- Grants: geen anon; publieke leespaden lopen via SECURITY DEFINER functies.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_details TO authenticated;
GRANT ALL ON public.event_details TO service_role;
GRANT SELECT, UPDATE ON public.ticket_instances TO authenticated;
GRANT ALL ON public.ticket_instances TO service_role;
GRANT ALL ON public.ticket_change_tokens TO service_role;

ALTER TABLE public.event_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_change_tokens ENABLE ROW LEVEL SECURITY;

-- event_details: tenant_admin + staff RW op eigen tenant.
CREATE POLICY "event_details_select_tenant" ON public.event_details
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "event_details_insert_tenant" ON public.event_details
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "event_details_update_tenant" ON public.event_details
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "event_details_delete_tenant" ON public.event_details
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));

-- ticket_instances: geen anon, geen publieke read. Tenant staff mag lezen + check-in.
CREATE POLICY "ticket_instances_select_tenant" ON public.ticket_instances
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));
CREATE POLICY "ticket_instances_update_tenant" ON public.ticket_instances
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]))
  WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid()))
         AND public.has_tenant_role(tenant_id, ARRAY['tenant_admin','staff']::app_role[]));

-- ticket_change_tokens: volledig dicht. service_role bypast RLS; geen policies nodig.

CREATE OR REPLACE FUNCTION public.get_public_events(p_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  product_id uuid,
  event_date date,
  start_time time,
  end_time time,
  meeting_point text,
  location_name text,
  capacity int,
  min_attendees int,
  status text,
  timezone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.product_id, e.event_date, e.start_time, e.end_time,
         e.meeting_point, e.location_name, e.capacity, e.min_attendees,
         e.status, e.timezone
  FROM public.event_details e
  WHERE e.tenant_id = p_tenant_id
    AND e.event_date >= CURRENT_DATE
    AND e.status NOT IN ('cancelled','skipped','merged')
  ORDER BY e.event_date, e.start_time
$$;

CREATE OR REPLACE FUNCTION public.get_event_signup_count(p_event_detail_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.ticket_instances t
  WHERE t.event_detail_id = p_event_detail_id
    AND t.status IN ('valid','checked_in')
$$;

GRANT EXECUTE ON FUNCTION public.get_public_events(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_signup_count(uuid) TO anon, authenticated;

CREATE TRIGGER update_event_details_updated_at
  BEFORE UPDATE ON public.event_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();