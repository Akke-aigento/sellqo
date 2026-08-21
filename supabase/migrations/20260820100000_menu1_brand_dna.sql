-- MENU-1 — Dagelijkse Menukaart, batch 1 (fundament).
--
-- Twee nieuwe tabellen. Strikt additief: raakt geen bestaande tabel, geen
-- gedeeld pad (tenant_theme_settings / themes / homepage_sections /
-- storefront_pages) en geen van de drie gedeelde edge-functies.
--
-- Idempotent: alles staat onder IF NOT EXISTS of DROP-dan-CREATE. Twee keer
-- draaien geeft hetzelfde resultaat.
--
-- Handmatig terugdraaien (er is geen DOWN):
--   DROP TABLE IF EXISTS public.tenant_content_categories;
--   DROP TABLE IF EXISTS public.tenant_brand_dna;
-- Beide tabellen zijn nieuw en worden door niets anders gerefereerd, dus de
-- volgorde is vrij en er blijven geen wezen achter.

-- ============ Stap 1 — tenant_brand_dna ============
-- Eén rij per tenant: het merk-DNA dat de generator leest, plus het ochtendmenu
-- (tellers + formaat-nadruk). Die twee zitten samen omdat ze dezelfde
-- cardinaliteit en levenscyclus hebben; een tweede 1:1-tabel zou alleen een
-- join opleveren.
CREATE TABLE IF NOT EXISTS public.tenant_brand_dna (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),

  -- merk-DNA
  brand_mission    text,
  target_audience  text,
  tone_keywords    text[] NOT NULL DEFAULT '{}',
  usps             text[] NOT NULL DEFAULT '{}',
  dos              text,
  donts            text,
  themes           text[] NOT NULL DEFAULT '{}',
  -- object, geen array: { "<setnaam>": ["#tag", ...] } zodat een set een
  -- stabiele naam als sleutel heeft.
  hashtag_sets     jsonb  NOT NULL DEFAULT '{}'::jsonb,
  free_dna         text,

  -- ochtendmenu
  -- { "<categorie-key>": <aantal> }. Sleutels zijn de vaste keys uit
  -- src/config/contentMenuCategories.ts of een slug uit
  -- tenant_content_categories.
  menu_counts      jsonb  NOT NULL DEFAULT '{}'::jsonb,
  format_emphasis  text   NOT NULL DEFAULT 'mixed',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_brand_dna_format_emphasis_check
    CHECK (format_emphasis IN ('mixed','short','long','visual','carousel'))
);

-- Dwingt "één rij per tenant" af én is het conflictdoel voor de upsert in
-- useBrandDna.ts (onConflict: 'tenant_id').
CREATE UNIQUE INDEX IF NOT EXISTS ux_tenant_brand_dna_tenant
  ON public.tenant_brand_dna (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_brand_dna TO authenticated;
GRANT ALL ON public.tenant_brand_dna TO service_role;
ALTER TABLE public.tenant_brand_dna ENABLE ROW LEVEL SECURITY;

-- ============ Stap 2 — tenant_content_categories ============
-- De eigen categorieën van een tenant (1:N). De vaste startset blijft in code
-- en krijgt hier bewust géén rijen: anders lopen de codelijst en de tabel uit
-- elkaar zodra er een categorie bijkomt.
CREATE TABLE IF NOT EXISTS public.tenant_content_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  slug         text NOT NULL,
  name         text NOT NULL,
  -- Verplicht op databaseniveau, niet alleen in de UI: een categorie zonder
  -- instructie levert de generator niets bruikbaars op.
  instructions text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_content_categories_name_not_blank
    CHECK (length(btrim(name)) > 0),
  CONSTRAINT tenant_content_categories_instructions_not_blank
    CHECK (length(btrim(instructions)) > 0),
  CONSTRAINT tenant_content_categories_slug_not_blank
    CHECK (length(btrim(slug)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tenant_content_categories_slug
  ON public.tenant_content_categories (tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_tenant_content_categories_tenant
  ON public.tenant_content_categories (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_content_categories TO authenticated;
GRANT ALL ON public.tenant_content_categories TO service_role;
ALTER TABLE public.tenant_content_categories ENABLE ROW LEVEL SECURITY;

-- ============ Stap 3 — RLS ============
-- Lezen mag elk lid van de tenant (spiegelt social_posts_select_members).
-- Schrijven vereist een rol, net als de *_insert_marketing-policies op
-- social_posts en requireRole in de bestaande AI-edge-functies.
DO $$
DECLARE
  t text;
  read_pred  text := '(tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())))';
  write_pred text := '(tenant_id IN (SELECT public.get_user_tenant_ids(auth.uid())) AND public.has_tenant_role(tenant_id, ARRAY[''tenant_admin''::app_role, ''staff''::app_role, ''marketing''::app_role]))';
BEGIN
  FOREACH t IN ARRAY ARRAY['tenant_brand_dna','tenant_content_categories']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_tenant', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_tenant', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_tenant', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_tenant', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING %s', t || '_select_tenant', t, read_pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK %s', t || '_insert_tenant', t, write_pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING %s WITH CHECK %s', t || '_update_tenant', t, write_pred, write_pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING %s', t || '_delete_tenant', t, write_pred);
  END LOOP;
END $$;

-- ============ Stap 4 — updated_at-triggers (bestaande helper) ============
DROP TRIGGER IF EXISTS update_tenant_brand_dna_updated_at ON public.tenant_brand_dna;
CREATE TRIGGER update_tenant_brand_dna_updated_at BEFORE UPDATE ON public.tenant_brand_dna
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_content_categories_updated_at ON public.tenant_content_categories;
CREATE TRIGGER update_tenant_content_categories_updated_at BEFORE UPDATE ON public.tenant_content_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
