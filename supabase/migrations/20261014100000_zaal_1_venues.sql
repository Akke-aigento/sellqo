-- ZAAL-1 — zalen met een stoelplan (concertzalen, theaters, sporthallen).
-- Een zaal teken je één keer per winkel en gebruik je voor elke eventdatum die erin
-- doorgaat (koppeling per datum volgt in ZAAL-2, via een aparte tabel event_seats).
--  - venues: de zaal;
--  - venue_sections: delen van de zaal (Parterre, Balkon…);
--  - venue_price_classes: prijsklassen (Categorie 1…), per datum gekoppeld aan een tickettype;
--  - venue_seats: elke stoel op een rooster (x, y) met rij, nummer, soort en prijsklasse.
--    Een gangpad is gewoon een lege x-positie.
-- Strikt additief: geen bestaande tabel of functie wordt aangeraakt.
-- RLS: hetzelfde predicaat als de eventtabellen (tenant_admin of staff van de winkel).

CREATE TABLE IF NOT EXISTS public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  stage_label text NOT NULL DEFAULT 'PODIUM',
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_venues_tenant ON public.venues (tenant_id);

CREATE TABLE IF NOT EXISTS public.venue_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_venue_sections_venue ON public.venue_sections (venue_id);

CREATE TABLE IF NOT EXISTS public.venue_price_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#1E3A5F',
  default_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (default_price >= 0),
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_venue_price_classes_venue ON public.venue_price_classes (venue_id);

CREATE TABLE IF NOT EXISTS public.venue_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.venue_sections(id) ON DELETE CASCADE,
  price_class_id uuid REFERENCES public.venue_price_classes(id) ON DELETE SET NULL,
  row_label text NOT NULL,
  seat_number text NOT NULL,
  x integer NOT NULL CHECK (x >= 0 AND x < 400),
  y integer NOT NULL CHECK (y >= 0 AND y < 400),
  kind text NOT NULL DEFAULT 'seat' CHECK (kind IN ('seat', 'wheelchair', 'companion')),
  sellable boolean NOT NULL DEFAULT true,
  CONSTRAINT venue_seats_position_unique UNIQUE (venue_id, x, y),
  CONSTRAINT venue_seats_label_unique UNIQUE (venue_id, section_id, row_label, seat_number)
);
CREATE INDEX IF NOT EXISTS idx_venue_seats_venue ON public.venue_seats (venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_seats_tenant ON public.venue_seats (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venues, public.venue_sections, public.venue_price_classes, public.venue_seats TO authenticated;
GRANT ALL ON public.venues, public.venue_sections, public.venue_price_classes, public.venue_seats TO service_role;

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_price_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_seats ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  pred text := '(tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.has_tenant_role(tenant_id, ARRAY[''tenant_admin''::app_role, ''staff''::app_role]))';
BEGIN
  FOREACH t IN ARRAY ARRAY['venues','venue_sections','venue_price_classes','venue_seats']
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

DROP TRIGGER IF EXISTS update_venues_updated_at ON public.venues;
CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
