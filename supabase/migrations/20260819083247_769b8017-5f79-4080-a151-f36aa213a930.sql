-- EVENT-SYSTEEM FASE 1 — scan-log-fundament. PUUR ADDITIEF, idempotent.
-- Rollback (handmatig): DROP de 5 nieuwe tabellen + de 6 helpers, DROP de 3 nieuwe
-- kolommen op ticket_instances en de 2 op event_details, en zet de oude
-- ticket_instances_status_check terug (zonder 'transferred').

-- ============ Stap 1a — event_groups ============
CREATE TABLE IF NOT EXISTS public.event_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_groups_tenant ON public.event_groups (tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_groups TO authenticated;
GRANT ALL ON public.event_groups TO service_role;
ALTER TABLE public.event_groups ENABLE ROW LEVEL SECURITY;

-- ============ Stap 1b — event_details uitbreiden ============
ALTER TABLE public.event_details ADD COLUMN IF NOT EXISTS event_group_id uuid;
ALTER TABLE public.event_details ADD COLUMN IF NOT EXISTS capacity_mode text NOT NULL DEFAULT 'sold';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_details_event_group_id_fkey') THEN
    ALTER TABLE public.event_details
      ADD CONSTRAINT event_details_event_group_id_fkey
      FOREIGN KEY (event_group_id) REFERENCES public.event_groups(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_details_capacity_mode_check') THEN
    ALTER TABLE public.event_details
      ADD CONSTRAINT event_details_capacity_mode_check
      CHECK (capacity_mode IN ('sold','inside'));
  END IF;
END $$;

-- ============ Stap 1c — event_zones ============
CREATE TABLE IF NOT EXISTS public.event_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  event_detail_id uuid REFERENCES public.event_details(id),
  event_group_id uuid REFERENCES public.event_groups(id),
  name text NOT NULL,
  capacity int,
  is_default boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  location_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_zones_owner_xor_check CHECK (
    (event_detail_id IS NOT NULL AND event_group_id IS NULL)
    OR (event_detail_id IS NULL AND event_group_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_event_zones_default_per_event
  ON public.event_zones (event_detail_id) WHERE is_default AND event_detail_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_zones_tenant ON public.event_zones (tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_zones_event ON public.event_zones (event_detail_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_zones TO authenticated;
GRANT ALL ON public.event_zones TO service_role;
ALTER TABLE public.event_zones ENABLE ROW LEVEL SECURITY;

-- ============ Stap 1d — event_ticket_types ============
CREATE TABLE IF NOT EXISTS public.event_ticket_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  event_detail_id uuid REFERENCES public.event_details(id),
  event_group_id uuid REFERENCES public.event_groups(id),
  valid_from timestamptz,
  valid_until timestamptz,
  sub_capacity int,
  sales_start timestamptz,
  sales_end timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  reentry_policy text NOT NULL DEFAULT 'none',
  zone_ids uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_ticket_types_reentry_policy_check
    CHECK (reentry_policy IN ('none','unlimited','once_per_day','once_per_event')),
  CONSTRAINT event_ticket_types_scope_xor_check CHECK (
    (CASE WHEN event_detail_id IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN event_group_id IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN valid_from IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_event_ticket_types_event_product
  ON public.event_ticket_types (event_detail_id, product_id) WHERE event_detail_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_ticket_types_tenant ON public.event_ticket_types (tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_ticket_types_product ON public.event_ticket_types (product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_ticket_types TO authenticated;
GRANT ALL ON public.event_ticket_types TO service_role;
ALTER TABLE public.event_ticket_types ENABLE ROW LEVEL SECURITY;

-- ============ Stap 1e — event_scanner_access ============
CREATE TABLE IF NOT EXISTS public.event_scanner_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  event_detail_id uuid NOT NULL REFERENCES public.event_details(id),
  zone_id uuid NOT NULL REFERENCES public.event_zones(id),
  name text NOT NULL,
  access_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  allowed_product_ids uuid[],
  direction text NOT NULL DEFAULT 'in',
  scan_mode text NOT NULL DEFAULT 'check_in',
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  use_count int NOT NULL DEFAULT 0,
  CONSTRAINT event_scanner_access_direction_check CHECK (direction IN ('in','out','both')),
  CONSTRAINT event_scanner_access_scan_mode_check CHECK (scan_mode IN ('check_in','validate_only','check_out'))
);
CREATE INDEX IF NOT EXISTS idx_event_scanner_access_tenant ON public.event_scanner_access (tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_scanner_access_event ON public.event_scanner_access (event_detail_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_scanner_access TO authenticated;
GRANT ALL ON public.event_scanner_access TO service_role;
ALTER TABLE public.event_scanner_access ENABLE ROW LEVEL SECURITY;

-- ============ Stap 1f — ticket_scans (het hart) ============
CREATE TABLE IF NOT EXISTS public.ticket_scans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  ticket_instance_id uuid NOT NULL REFERENCES public.ticket_instances(id),
  event_detail_id uuid NOT NULL REFERENCES public.event_details(id),
  zone_id uuid REFERENCES public.event_zones(id),
  scanner_access_id uuid REFERENCES public.event_scanner_access(id),
  scanned_by_user_id uuid,
  direction text NOT NULL,
  result text NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  device_id text,
  offline_synced boolean NOT NULL DEFAULT false,
  offline_scanned_at timestamptz,
  note text,
  CONSTRAINT ticket_scans_direction_check CHECK (direction IN ('in','out')),
  CONSTRAINT ticket_scans_result_check CHECK (result IN (
    'ok','already_inside','not_allowed_zone','wrong_event','invalid','cancelled',
    'reentry_blocked','zone_full','expired','manual_override','undo'
  ))
);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_ticket ON public.ticket_scans (ticket_instance_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_event_zone ON public.ticket_scans (event_detail_id, zone_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_tenant ON public.ticket_scans (tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_scans TO authenticated;
GRANT ALL ON public.ticket_scans TO service_role;
ALTER TABLE public.ticket_scans ENABLE ROW LEVEL SECURITY;

-- ============ Stap 1g — RLS-policies (zelfde predicaat als event_details) ============
DO $$
DECLARE
  t text;
  pred text := '(tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.has_tenant_role(tenant_id, ARRAY[''tenant_admin''::app_role, ''staff''::app_role]))';
BEGIN
  FOREACH t IN ARRAY ARRAY['event_groups','event_zones','event_ticket_types','event_scanner_access','ticket_scans']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_tenant', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_tenant', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_tenant', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_tenant', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING %s', t || '_select_tenant', t, pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK %s', t || '_insert_tenant', t, pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING %s WITH CHECK %s', t || '_update_tenant', t, pred, pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING %s', t || '_delete_tenant', t, pred);
  END LOOP;
END $$;

-- updated_at triggers (bestaande helper)
DROP TRIGGER IF EXISTS update_event_groups_updated_at ON public.event_groups;
CREATE TRIGGER update_event_groups_updated_at BEFORE UPDATE ON public.event_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_event_ticket_types_updated_at ON public.event_ticket_types;
CREATE TRIGGER update_event_ticket_types_updated_at BEFORE UPDATE ON public.event_ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Stap 2 — ticket_instances additief ============
ALTER TABLE public.ticket_instances ADD COLUMN IF NOT EXISTS product_id uuid;
ALTER TABLE public.ticket_instances ADD COLUMN IF NOT EXISTS seat_label text;
ALTER TABLE public.ticket_instances ADD COLUMN IF NOT EXISTS is_complimentary boolean NOT NULL DEFAULT false;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_instances_product_id_fkey') THEN
    ALTER TABLE public.ticket_instances
      ADD CONSTRAINT ticket_instances_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id);
  END IF;
END $$;

UPDATE public.ticket_instances ti
SET product_id = oi.product_id
FROM public.order_items oi
WHERE ti.order_item_id = oi.id AND ti.product_id IS NULL AND oi.product_id IS NOT NULL;

-- CHECK verruimen: 'checked_in' BLIJFT bewust staan (compat met alle bestaande lezers).
ALTER TABLE public.ticket_instances DROP CONSTRAINT IF EXISTS ticket_instances_status_check;
ALTER TABLE public.ticket_instances
  ADD CONSTRAINT ticket_instances_status_check
  CHECK (status IN ('valid','checked_in','cancelled','refunded','transferred'));

-- ============ Stap 3 — migratie bestaande data (idempotent) ============
INSERT INTO public.event_zones (tenant_id, event_detail_id, name, is_default, capacity, sort_order)
SELECT ed.tenant_id, ed.id, 'Ingang', true, NULL, 0
FROM public.event_details ed
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_zones z WHERE z.event_detail_id = ed.id AND z.is_default
);

INSERT INTO public.event_ticket_types (tenant_id, product_id, event_detail_id, reentry_policy, zone_ids, is_active)
SELECT ed.tenant_id, ed.product_id, ed.id, 'none', NULL, true
FROM public.event_details ed
WHERE ed.product_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.ticket_scans (
  tenant_id, ticket_instance_id, event_detail_id, zone_id,
  scanned_by_user_id, direction, result, scanned_at, note
)
SELECT ti.tenant_id, ti.id, ti.event_detail_id, z.id,
       ti.checked_in_by, 'in', 'ok', COALESCE(ti.checked_in_at, now()),
       'gemigreerd uit ticket_instances.checked_in_at (event-systeem fase 1)'
FROM public.ticket_instances ti
LEFT JOIN public.event_zones z ON z.event_detail_id = ti.event_detail_id AND z.is_default
WHERE ti.status = 'checked_in'
  AND NOT EXISTS (
    SELECT 1 FROM public.ticket_scans s WHERE s.ticket_instance_id = ti.id
  );

-- ============ Stap 4 — afgeleide helpers ============
CREATE OR REPLACE FUNCTION public.ticket_last_scan(p_ticket_id uuid)
RETURNS public.ticket_scans
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT s.* FROM public.ticket_scans s
  WHERE s.ticket_instance_id = p_ticket_id
  ORDER BY s.scanned_at DESC, s.id DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.ticket_is_inside(p_ticket_id uuid, p_zone_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT s.direction = 'in'
    FROM public.ticket_scans s
    WHERE s.ticket_instance_id = p_ticket_id
      AND s.result IN ('ok','manual_override')
      AND (p_zone_id IS NULL OR s.zone_id = p_zone_id)
    ORDER BY s.scanned_at DESC, s.id DESC
    LIMIT 1
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.zone_occupancy(p_zone_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::int FROM (
    SELECT DISTINCT ON (s.ticket_instance_id) s.direction
    FROM public.ticket_scans s
    WHERE s.zone_id = p_zone_id
      AND s.result IN ('ok','manual_override')
    ORDER BY s.ticket_instance_id, s.scanned_at DESC, s.id DESC
  ) last_per_ticket
  WHERE direction = 'in'
$$;

CREATE OR REPLACE FUNCTION public.event_occupancy(p_event_detail_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::int FROM (
    SELECT DISTINCT ON (s.ticket_instance_id) s.direction
    FROM public.ticket_scans s
    JOIN public.event_details ed ON ed.id = p_event_detail_id
    LEFT JOIN public.event_zones z ON z.id = s.zone_id
    WHERE s.event_detail_id = p_event_detail_id
      AND s.result IN ('ok','manual_override')
      AND (ed.capacity_mode = 'inside' OR z.is_default IS TRUE OR s.zone_id IS NULL)
    ORDER BY s.ticket_instance_id, s.scanned_at DESC, s.id DESC
  ) last_per_ticket
  WHERE direction = 'in'
$$;

CREATE OR REPLACE FUNCTION public.ticket_checkin_status(p_ticket_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT CASE WHEN s.direction = 'in' THEN 'inside' ELSE 'left' END
    FROM public.ticket_scans s
    WHERE s.ticket_instance_id = p_ticket_id
      AND s.result IN ('ok','manual_override')
    ORDER BY s.scanned_at DESC, s.id DESC
    LIMIT 1
  ), 'not_scanned')
$$;

CREATE OR REPLACE FUNCTION public.get_event_ticket_type_count(p_event_detail_id uuid, p_product_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::int
  FROM public.ticket_instances t
  WHERE t.event_detail_id = p_event_detail_id
    AND t.product_id = p_product_id
    AND t.status IN ('valid','checked_in')
$$;

GRANT EXECUTE ON FUNCTION public.ticket_last_scan(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ticket_is_inside(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.zone_occupancy(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.event_occupancy(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ticket_checkin_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_event_ticket_type_count(uuid, uuid) TO authenticated, service_role;