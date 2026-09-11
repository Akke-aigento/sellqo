-- De unieke indexen waar ads-bolcom-sync en ads-bolcom-reports al maanden naar
-- verwijzen zonder dat ze bestaan.
--
-- Beide functies doen `upsert(..., { onConflict: "..." })`. PostgreSQL weigert een
-- ON CONFLICT die geen unieke index aanwijst, met 42P10. Vier van de zes
-- wegschrijfacties in die twee functies noemen een index die er niet is:
--
--   ads_bolcom_keywords            (tenant_id, adgroup_id, keyword, match_type)
--   ads_bolcom_targeting_products  (tenant_id, adgroup_id, ean)
--   ads_bolcom_search_terms        (tenant_id, search_term, date)
--   ads_bolcom_performance         (tenant_id, campaign_id, date)
--
-- Dat is nooit opgevallen omdat de bol.com-fetch ervóór al faalde: er kwam nooit een
-- rij bij de upsert aan. Repareer je alleen de API-paden, dan verschuift het probleem
-- van "fetch faalt" naar "upsert faalt" — even stil, want het patroon in beide
-- functies is `if (!error) teller++; else console.error(...)`. De fout gaat naar de
-- log, de teller blijft nul, en de functie meldt zichzelf als geslaagd.
--
-- Op ads_bolcom_performance bestaat wél een vijfkolommige unieke index, maar die
-- dedupliceert niet waar het nodig is: adgroup_id en keyword_id zijn nullable en bij
-- campagne-niveau-rijen NULL. Met de standaard NULLS DISTINCT is NULL nooit gelijk aan
-- NULL, dus twee rijen voor dezelfde campagne op dezelfde dag gelden niet als
-- duplicaat — elke dagelijkse run zou de dag opnieuw toevoegen en de grafieken zouden
-- gaan optellen. Vandaar NULLS NOT DISTINCT (PostgreSQL 15+; deze database draait 17.6).
--
-- Strikt additief: alleen CREATE INDEX. Er wordt geen kolom en geen bestaande index
-- aangeraakt. De oude vijfkolommige index blijft staan — hij hindert niet en droppen is
-- onomkeerbaar. Alleen de nieuwe wordt door de code aangewezen.
--
-- Veilig uit te voeren: op ads_bolcom_campaigns (4 rijen) na zijn alle betrokken
-- tabellen leeg, dus geen van deze indexen kan op bestaande duplicaten stuklopen.
-- Nagetrokken op 11 september 2026, niet aangenomen.
--
-- Idempotent via IF NOT EXISTS; twee keer draaien geeft hetzelfde resultaat.
--
-- DOWN (handmatig):
--   DROP INDEX IF EXISTS public.ads_bolcom_keywords_uniq;
--   DROP INDEX IF EXISTS public.ads_bolcom_targeting_products_uniq;
--   DROP INDEX IF EXISTS public.ads_bolcom_search_terms_uniq;
--   DROP INDEX IF EXISTS public.ads_bolcom_performance_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS ads_bolcom_keywords_uniq
  ON public.ads_bolcom_keywords (tenant_id, adgroup_id, keyword, match_type);

CREATE UNIQUE INDEX IF NOT EXISTS ads_bolcom_targeting_products_uniq
  ON public.ads_bolcom_targeting_products (tenant_id, adgroup_id, ean);

-- campaign_id en adgroup_id zijn nullable op deze tabel: een zoekterm hoort bij een
-- ad group, maar de koppeling terug naar de campagne is niet altijd te leggen.
CREATE UNIQUE INDEX IF NOT EXISTS ads_bolcom_search_terms_uniq
  ON public.ads_bolcom_search_terms (tenant_id, campaign_id, adgroup_id, search_term, date)
  NULLS NOT DISTINCT;

-- Dezelfde tabel draagt rijen op drie niveaus: campagne (adgroup_id en keyword_id NULL),
-- ad group (keyword_id NULL) en keyword. NULLS NOT DISTINCT is precies wat die drie
-- niveaus naast elkaar laat bestaan én elk niveau op zichzelf dedupliceert.
CREATE UNIQUE INDEX IF NOT EXISTS ads_bolcom_performance_uniq
  ON public.ads_bolcom_performance (tenant_id, campaign_id, adgroup_id, keyword_id, date)
  NULLS NOT DISTINCT;
