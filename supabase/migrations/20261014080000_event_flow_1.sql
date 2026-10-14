-- EVENT-FLOW-1 — elke nieuwe eventdatum is meteen verkoopbaar.
-- storefront-api cart_add_item eist een actieve event_ticket_types-rij voor (event, product).
-- useCreateEventDate en useBulkCreateEventDates maakten die niet aan; enkel de eenmalige
-- backfill van augustus (20260819083247) had ze voor de toen bestaande events. Een event
-- van 24/10 bij Fonske was daardoor onverkoopbaar (TICKET_TYPE_UNAVAILABLE).
-- Oplossing: één AFTER INSERT-trigger, ongeacht via welke knop of welk pad de datum ontstaat.
-- Dezelfde defaults als de backfill: tickettype 'none', zone_ids NULL, actief; default-zone 'Ingang'.
-- Idempotent: ON CONFLICT DO NOTHING op de bestaande unieke indexen
-- (ux_event_ticket_types_event_product, ux_event_zones_default_per_event).

CREATE OR REPLACE FUNCTION public.event_details_create_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    INSERT INTO public.event_ticket_types (tenant_id, product_id, event_detail_id, reentry_policy, zone_ids, is_active)
    VALUES (NEW.tenant_id, NEW.product_id, NEW.id, 'none', NULL, true)
    ON CONFLICT (event_detail_id, product_id) WHERE event_detail_id IS NOT NULL DO NOTHING;
  END IF;

  INSERT INTO public.event_zones (tenant_id, event_detail_id, name, is_default, capacity, sort_order)
  VALUES (NEW.tenant_id, NEW.id, 'Ingang', true, NULL, 0)
  ON CONFLICT (event_detail_id) WHERE is_default AND event_detail_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.event_details_create_defaults() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_event_details_create_defaults ON public.event_details;
CREATE TRIGGER trg_event_details_create_defaults
  AFTER INSERT ON public.event_details
  FOR EACH ROW EXECUTE FUNCTION public.event_details_create_defaults();

-- Natrek: toekomstige datums (vaste peildatum 2026-10-14, geen now()) zonder tickettype of
-- default-zone. Op 14-10 10u25 waren dat er 0 (Fonske 24/10 handmatig rechtgezet); dit vangt
-- alles wat tussen die check en deze migratie ontstond.
INSERT INTO public.event_ticket_types (tenant_id, product_id, event_detail_id, reentry_policy, zone_ids, is_active)
SELECT ed.tenant_id, ed.product_id, ed.id, 'none', NULL, true
FROM public.event_details ed
WHERE ed.event_date >= DATE '2026-10-14' AND ed.product_id IS NOT NULL
ON CONFLICT (event_detail_id, product_id) WHERE event_detail_id IS NOT NULL DO NOTHING;

INSERT INTO public.event_zones (tenant_id, event_detail_id, name, is_default, capacity, sort_order)
SELECT ed.tenant_id, ed.id, 'Ingang', true, NULL, 0
FROM public.event_details ed
WHERE ed.event_date >= DATE '2026-10-14'
ON CONFLICT (event_detail_id) WHERE is_default AND event_detail_id IS NOT NULL DO NOTHING;
