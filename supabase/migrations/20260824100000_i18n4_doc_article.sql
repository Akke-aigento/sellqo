-- I18N-4 — in-app doc-artikel over de taalinstelling van de admin.
--
-- De marketeer-zone is deze batch volledig meertalig gemaakt (nl/en/fr/de/uk).
-- Dit artikel legt uit waar je de taal instelt, wat er wél en niet meebeweegt,
-- en waarom bedragen Nederlands blijven.
--
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE, dus twee keer draaien
-- geeft hetzelfde resultaat.
--
-- Handmatig terugdraaien:
--   DELETE FROM public.doc_articles
--   WHERE doc_level = 'tenant' AND slug = 'admin-taal-instellen';
--
-- Categorie: Webshop (a0000001-0000-0000-0000-000000000006). Er is geen
-- categorie voor "Account & instellingen"; Webshop is de dichtstbijzijnde
-- bestaande categorie en wordt hier niet uitgebreid.
INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES (
  'tenant',
  'a0000001-0000-0000-0000-000000000006',
  '/admin/settings',
  'De taal van je admin instellen',
  'admin-taal-instellen',
  'Waar je je eigen admintaal kiest, welke schermen meebewegen en waarom bedragen Nederlands blijven.',
  '<p>De taal van de admin staat <strong>per gebruiker</strong> ingesteld, niet per winkel. Jij kunt de admin dus in het Frans gebruiken terwijl je collega hem in het Nederlands ziet, en terwijl je webshop in beide talen draait. Je vindt de keuze in de taalkiezer rechtsboven in de admin.</p>
<p>Ondersteund zijn <strong>Nederlands, Engels, Frans, Duits en Oekraïens</strong>.</p>
<h3>Wat beweegt mee met je taalkeuze</h3>
<ul>
<li>Alle knoppen, labels, tabbladen en menu-items.</li>
<li>Foutmeldingen en de bevestigingen die na een actie verschijnen.</li>
<li>De teksten in keuzelijsten en statusbadges — bijvoorbeeld de status van een bestelling of een campagne.</li>
<li>Meldingen onder een formulierveld als er iets ontbreekt.</li>
<li><strong>Datums en tijden.</strong> Dag- en maandnamen en aanduidingen als "3 dagen geleden" volgen sinds deze versie je eigen taal.</li>
</ul>
<h3>Wat bewust niet meebeweegt</h3>
<ul>
<li><strong>Bedragen.</strong> Die blijven in het Nederlandse formaat staan, met een komma als decimaalteken en een punt als duizendtalscheiding. Dat is een boekhoudkundige keuze: je facturen, exports en boekhoudkoppeling gebruiken hetzelfde formaat, en dat mag niet per gebruiker verschillen.</li>
<li><strong>Je eigen content.</strong> Productnamen, categorieën, e-mailteksten en pagina''s zijn jouw teksten. Die vertaal je in de <strong>Vertaalhub</strong> (Marketing → Vertalingen), waar je per taal een versie beheert of de AI het laat doen.</li>
<li><strong>Merknamen en vaktermen.</strong> Bol.com, Peppol, SKU, EAN, Sitemap.xml, Core Web Vitals en dergelijke blijven in elke taal hetzelfde — die zijn internationaal.</li>
<li><strong>De taal van je webshop.</strong> Die staat los van je admintaal en stel je in bij de webshop-instellingen. Klanten zien dus niet wat jij ziet.</li>
</ul>
<h3>Wat een klant in zijn eigen taal krijgt</h3>
<p>E-mailcampagnes gaan uit in de <strong>voorkeurstaal van de klant</strong>, niet in die van jou. Heeft een klant geen voorkeur opgegeven, dan krijgt hij de Nederlandse versie. In de campagne-editor maak je per taal een variant; de uitschrijflink onderaan de mail hoort bij de mail zelf en volgt dus ook de klant.</p>
<h3>Een taal ontbreekt</h3>
<p>Zie je toch ergens Nederlandse tekst staan terwijl je een andere taal hebt ingesteld? Meld het via de helpfunctie met een schermafdruk. Ontbrekende teksten vallen bewust terug op het Nederlands in plaats van leeg te blijven, zodat een scherm altijd bruikbaar blijft.</p>',
  9
)
ON CONFLICT (doc_level, slug) DO UPDATE
SET category_id  = EXCLUDED.category_id,
    context_path = EXCLUDED.context_path,
    title        = EXCLUDED.title,
    excerpt      = EXCLUDED.excerpt,
    content      = EXCLUDED.content,
    sort_order   = EXCLUDED.sort_order;
