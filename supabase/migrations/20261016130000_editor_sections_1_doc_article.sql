-- EDITOR-SECTIONS-1 — helpartikel "Theme aanpassen" aangevuld (bestaand artikel).
-- Nieuw: secties toevoegen in Webshop → Aanpassen (diavoorstelling, logo's en merken, kolommen,
-- tekstblok, winkelreviews), de beeldkiezer, video die pas laadt na een klik en FAQ als
-- gestructureerde gegevens. Bron van het gedrag: storefront-commits f627800 (SHOP-SECTIONS-1)
-- en 7bb056a (SHOP-POLISH-2), admin-editor EDITOR-SECTIONS-1.
-- Basis: de live content van 16-10-2026 (updated_at 2026-07-17 15:27, md5
-- 83e201c6d4be4d528c9979b8a372ab5f), via query_database nagelezen en byte-exact overgenomen;
-- er is alleen een blok ingevoegd vóór "<h3>Visuele editor</h3>". Nieuwe content-md5:
-- 0988c2f7d98e0d362d60120c28414a2f. Categorie (a0000001-...0006), context_path, titel, excerpt, tags en sort_order
-- blijven zoals live.
--
-- PAS DRAAIEN NA de deploy van de storefront (f627800 + 7bb056a) én de publish van sellqo.app
-- met EDITOR-SECTIONS-1, anders beschrijft het artikel een beeldkiezer die er nog niet is.
--
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE, met een VASTE updated_at.
-- Handmatig terugdraaien: snapshot de huidige rij vóór het draaien
--   (create table snapshots.sellqo_20261016_doc_articles_es1 as select * from public.doc_articles
--    where doc_level='tenant' and slug='theme-aanpassen';)
-- en zet daarna content/updated_at terug uit die snapshot.
-- Natrek na het draaien: select md5(content) from public.doc_articles
--   where doc_level='tenant' and slug='theme-aanpassen';  -- verwacht 0988c2f7d98e0d362d60120c28414a2f

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, tags, sort_order, updated_at)
VALUES
(
  'tenant',
  'a0000001-0000-0000-0000-000000000006',
  '/admin/storefront',
  'Theme aanpassen',
  'theme-aanpassen',
  'Kleuren, fonts, logo en homepage-secties aanpassen — plus de visuele editor op Pro.',
  $html$<h2>Theme aanpassen</h2><p>Ga naar <strong>Webshop</strong> om het uiterlijk van je shop in te stellen.</p><h3>Wat kan je aanpassen?</h3><ul><li><strong>Kleuren</strong> — primaire kleur, accenten en achtergronden, afgestemd op je huisstijl</li><li><strong>Lettertypen</strong> — kies uit een reeks webfonts voor koppen en lopende tekst</li><li><strong>Logo &amp; favicon</strong> — upload je eigen logo</li><li><strong>Homepage-secties</strong> — hero, uitgelichte producten, banners en tekstblokken, herschikbaar via de editor</li></ul><h3>Secties toevoegen in Aanpassen</h3><p>Ga naar <strong>Webshop → Aanpassen</strong> en kies onder je homepage-secties <strong>Sectie toevoegen</strong>. Je ziet je winkel er meteen naast, ook voor je opslaat. Naast hero, uitgelichte producten, tekst met afbeelding, voordelen en FAQ kan je kiezen uit:</p><ul><li><strong>Diavoorstelling</strong> — tot zes dia's met afbeelding, titel, tekst en knop. Bezoekers vegen of klikken erdoor. Automatisch wisselen staat standaard uit; zet je het aan, dan stopt het bij aanraken en voor bezoekers die minder beweging willen.</li><li><strong>Logo's en merken</strong> — een strook met logo's van merken die je verkoopt, partners of pers. Zonder logo tonen we de naam. Optioneel in grijstinten, met kleur bij aanwijzen.</li><li><strong>Kolommen</strong> — twee tot vier blokken naast elkaar (op gsm onder elkaar), elk met afbeelding, titel, tekst en link.</li><li><strong>Tekstblok</strong> — een titel met tekst en een knop, bijvoorbeeld over je winkel of je verhaal.</li><li><strong>Winkelreviews</strong> — je reviews van Google, Trustpilot en andere platformen, met je gemiddelde score. Je kiest hoeveel reviews je toont en of je alleen uitgelichte reviews toont. Zonder reviews blijft de sectie verborgen.</li></ul><p><strong>Afbeeldingen</strong> in deze secties kies je met de beeldkiezer: klik op het vlak en sleep een afbeelding erin of blader naar een bestand. Met <strong>Verwijderen</strong> haal je de afbeelding weer weg; een dia zonder afbeelding krijgt een gekleurd vlak.</p><p><strong>Video:</strong> een videosectie toont eerst alleen een afspeelknop (en je eigen voorbeeldafbeelding als je die kiest). De speler van YouTube of Vimeo laadt pas als je bezoeker op afspelen klikt; tot dan gaat er geen verzoek naar YouTube of Vimeo. Zet je automatisch afspelen aan, dan laadt de speler meteen.</p><p><strong>FAQ:</strong> de vragen met een antwoord uit je FAQ-sectie staan ook als gestructureerde gegevens in je homepage, zodat zoekmachines ze kunnen lezen. Of Google ze apart toont in de zoekresultaten, beslist Google zelf.</p><p>Een lege of onvolledige sectie zie je in de editor als een gestippeld uitlegkader; in je winkel blijft ze weg tot ze ingevuld is. Deze secties zijn er voor winkels op het SellQo-thema; een winkel met een eigen frontend toont ze niet vanzelf.</p><h3>Visuele editor</h3><p>Vanaf het Pro-abonnement is de <strong>visuele editor</strong> beschikbaar: pas je pagina's live aan met drag-and-drop en zie meteen het resultaat zoals je klanten het zien.</p><h3>Extra pagina's</h3><p>Via <strong>CMS-pagina's</strong> maak je extra content-pagina's aan (bv. Over ons, Lookbook) die je aan je shopnavigatie kan toevoegen.</p>$html$,
  ARRAY[]::text[],
  1,
  '2026-10-16 13:00:00+00'
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  context_path = EXCLUDED.context_path,
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags,
  sort_order = EXCLUDED.sort_order,
  updated_at = EXCLUDED.updated_at;
