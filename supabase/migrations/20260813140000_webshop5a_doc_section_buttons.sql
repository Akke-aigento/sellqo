-- WEBSHOP-5A slottaak: documentatie-artikel over knoppen in homepage-secties
--
-- Contextuele hulp op /admin/storefront, waar de tenant zijn secties inricht.
-- Sluit aan op de linkfix uit WEBSHOP-5A: knoppen verwijzen voortaan met een
-- shop-relatief pad en worden bij het renderen tegen het winkelpad opgelost.
--
-- REIKWIJDTE:
--   * één rij in public.doc_articles, onder de bestaande tenant-categorie
--     Webshop (a0000001-0000-0000-0000-000000000006)
--   * geen kolom of tabel gewijzigd
--   * idempotent via ON CONFLICT (doc_level, slug), de bestaande unieke sleutel

INSERT INTO public.doc_articles
  (category_id, doc_level, title, slug, excerpt, content, context_path, sort_order)
VALUES (
  'a0000001-0000-0000-0000-000000000006',
  'tenant',
  'Knoppen in je homepage-secties',
  'homepage-sectie-knoppen',
  'Hoe je een knop in een hero- of tekstsectie naar de juiste pagina laat verwijzen.',
  '<h2>Een knop toevoegen</h2>
<p>De hero-sectie en de sectie <strong>Tekst + afbeelding</strong> kunnen een knop tonen. Je vult twee dingen in: de <strong>knoptekst</strong> die de bezoeker leest, en de <strong>bestemming</strong>. De knop verschijnt pas als beide zijn ingevuld.</p>

<h2>Verwijzen naar een pagina in je eigen winkel</h2>
<p>Kies de bestemming uit de lijst. Je kunt kiezen uit je productoverzicht, je winkelwagen, je homepage en elke categorie die je hebt aangemaakt. SellQo koppelt die keuze automatisch aan het adres van jouw winkel, dus je hoeft nooit zelf een volledig webadres te typen.</p>
<p>Werk je met een eigen domein, dan blijft de knop ook daar naar de juiste pagina verwijzen. Je hoeft niets aan te passen als je later een domein koppelt.</p>

<h2>Verwijzen naar een andere website</h2>
<p>Wil je naar een externe site verwijzen, vul dan het volledige adres in, inclusief <code>https://</code>. Zo''n link opent automatisch in een nieuw tabblad, zodat de bezoeker je winkel niet verlaat.</p>
<p>Ook <code>mailto:</code> voor een e-mailadres en <code>tel:</code> voor een telefoonnummer werken. Bijvoorbeeld <code>mailto:info@jouwwinkel.be</code> opent het mailprogramma van de bezoeker.</p>

<h2>Controleer je knop</h2>
<p>Open je winkel via <strong>Bekijk winkel</strong> op het overzicht en klik de knop aan. Kom je op de verwachte pagina uit, dan staat het goed.</p>

<h3>De knop doet niets</h3>
<p>Controleer of de knoptekst is ingevuld. Zonder tekst wordt de knop niet getoond, ook al staat er een bestemming.</p>

<h3>Ik kom op een lege pagina uit</h3>
<p>Verwijs je naar een pagina die je later hebt hernoemd of verwijderd? Kies de bestemming dan opnieuw uit de lijst.</p>',
  '/admin/storefront',
  7
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  category_id  = EXCLUDED.category_id,
  title        = EXCLUDED.title,
  excerpt      = EXCLUDED.excerpt,
  content      = EXCLUDED.content,
  context_path = EXCLUDED.context_path,
  sort_order   = EXCLUDED.sort_order,
  updated_at   = now();

-- Controle na afloop:
--   SELECT slug, title, context_path, is_published
--   FROM public.doc_articles
--   WHERE slug = 'homepage-sectie-knoppen';
