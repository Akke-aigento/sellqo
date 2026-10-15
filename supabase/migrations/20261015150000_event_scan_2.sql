-- EVENT-SCAN-2 — scan-eerst: de deur herkent het event zelf.
-- Additief: bestaande scanlinks houden hun event en zone en gedragen zich identiek.
--  1. Scanlinks zonder event/zone = vaste deurlink van de winkel (het ticket wijst
--     het event aan; het scanvenster bewaakt dat het NU klopt).
--  2. event_scan_settings: het venster per tenant (standaard 60 min vóór start tot
--     60 min na einde; geen eindtijd → start + 6 uur als rekeneinde).

ALTER TABLE public.event_scanner_access ALTER COLUMN event_detail_id DROP NOT NULL;
ALTER TABLE public.event_scanner_access ALTER COLUMN zone_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.event_scan_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  open_before_minutes integer NOT NULL DEFAULT 60 CHECK (open_before_minutes BETWEEN 0 AND 10080),
  close_after_minutes integer NOT NULL DEFAULT 60 CHECK (close_after_minutes BETWEEN 0 AND 10080),
  no_end_fallback_hours integer NOT NULL DEFAULT 6 CHECK (no_end_fallback_hours BETWEEN 1 AND 168),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_scan_settings TO authenticated;
GRANT ALL ON public.event_scan_settings TO service_role;
ALTER TABLE public.event_scan_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  rd text := '(tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.has_tenant_role(tenant_id, ARRAY[''tenant_admin''::app_role, ''staff''::app_role]))';
  wr text := '(tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.has_tenant_role(tenant_id, ARRAY[''tenant_admin''::app_role]))';
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS event_scan_settings_select_tenant ON public.event_scan_settings';
  EXECUTE format('CREATE POLICY event_scan_settings_select_tenant ON public.event_scan_settings FOR SELECT TO authenticated USING %s', rd);
  EXECUTE 'DROP POLICY IF EXISTS event_scan_settings_insert_tenant ON public.event_scan_settings';
  EXECUTE format('CREATE POLICY event_scan_settings_insert_tenant ON public.event_scan_settings FOR INSERT TO authenticated WITH CHECK %s', wr);
  EXECUTE 'DROP POLICY IF EXISTS event_scan_settings_update_tenant ON public.event_scan_settings';
  EXECUTE format('CREATE POLICY event_scan_settings_update_tenant ON public.event_scan_settings FOR UPDATE TO authenticated USING %s WITH CHECK %s', wr, wr);
  EXECUTE 'DROP POLICY IF EXISTS event_scan_settings_delete_tenant ON public.event_scan_settings';
  EXECUTE format('CREATE POLICY event_scan_settings_delete_tenant ON public.event_scan_settings FOR DELETE TO authenticated USING %s', wr);
END $$;
