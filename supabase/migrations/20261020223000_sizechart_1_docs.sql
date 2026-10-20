-- SIZECHART-1 — helpartikels voor de standaard-maattabel.
-- Enkel doc_articles: geen schema-, RLS- of functiewijzigingen.
-- Idempotent: insert met ON CONFLICT (doc_level, slug), update via replace() die
-- na de eerste run niets meer vindt.
-- Handmatig terugdraaien:
--   delete from public.doc_articles where doc_level = 'tenant' and slug = 'maattabel-printful';
--   en de zin in 'printful-print-on-demand-koppelen' terugzetten (zie de replace hieronder, omgekeerd).

insert into public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
values (
  'tenant',
  'a0000001-0000-0000-0000-000000000001',
  '/admin/products',
  'Maattabel: zo rekent SellQo de Printful-maten om en controleert ze',
  'maattabel-printful',
  'Elke maatgids uit Printful wordt omgezet naar één vaste tabel in hele cm en bij elke import gecontroleerd. Zo lees je de tab Maattabel.',
  $html$
<h2>Wat is de standaard-maattabel?</h2>
<p>Printful levert bij veel producten een maatgids mee, maar in wisselende vormen: soms in inch met breuken, soms met lichaamsmaten die de maten van het kledingstuk herhalen, en zonder uitleg waar je meet. SellQo zet elke maatgids om naar één vaste tabel, voor elk product hetzelfde:</p>
<ul>
  <li><strong>Breedte</strong>: het kledingstuk plat gelegd, van oksel tot oksel.</li>
  <li><strong>Lengte</strong>: van het hoogste punt van de schouder tot de onderzoom.</li>
  <li><strong>Mouw</strong>: als Printful die meegeeft.</li>
  <li><strong>Past bij borstomtrek</strong>: de lichaamsmaat waarvoor de maat bedoeld is, als Printful die meegeeft.</li>
</ul>
<p>Alle waarden staan in hele cm. Maten die je niet verkoopt, worden niet getoond.</p>

<h2>Waar vind je hem?</h2>
<p>Open een product met een maatgids en kies de tab <strong>Maattabel</strong>. Je ziet de tabel precies zoals je klant hem krijgt, een status en de uitkomst van de controles. Producten zonder maatgids hebben deze tab niet.</p>

<h2>De controles</h2>
<p>Bij elke import uit Printful, en telkens als je winkel het product toont, controleert SellQo de cijfers:</p>
<ul>
  <li>Spreken de cm- en de inch-tabel van Printful elkaar tegen?</li>
  <li>Staat er een tabel als cm aangeleverd die eigenlijk in inch is?</li>
  <li>Lijkt een breedte eigenlijk een omtrek (rondom gemeten)?</li>
  <li>Wordt elke maat groter dan de vorige, zonder rare sprongen?</li>
  <li>Is het kledingstuk niet kleiner dan de borstomtrek waarvoor het bedoeld is?</li>
  <li>Staat elke maat die je verkoopt in de maatgids?</li>
  <li>Zijn er minstens een breedte en een lengte?</li>
</ul>
<p>Een meting die niet in een standaardkolom past (bijvoorbeeld een binnenbeenlengte), wordt niet getoond en staat als opmerking bij de controles. SellQo gokt nooit een waarde.</p>

<h2>Wat betekent de status?</h2>
<ul>
  <li><strong>In orde</strong>: alle controles geslaagd. De tabel staat zo in je winkel.</li>
  <li><strong>Nakijken</strong>: de tabel staat online, maar er valt iets op. Lees de punten bij de controles.</li>
  <li><strong>Niet online</strong>: de data klopt niet. Je winkel toont voor dit product geen maattabel, zodat een klant nooit op foute maten bestelt.</li>
</ul>
<p>Na een import met producten die nagekeken moeten worden, krijg je daar meteen een melding van.</p>

<h2>Pasvorm</h2>
<p>Geeft Printful ook de borstomtrek, dan berekent SellQo de pasvorm uit het verschil tussen het kledingstuk en het lichaam: aansluitend, normaal, ruim of zeer ruim. Dat is een berekening, geen opgave van Printful.</p>

<h2>Iets aangepast in Printful?</h2>
<p>Importeer het product opnieuw via <strong>SellQo Connect &rarr; Fulfilment &rarr; Producten importeren uit Printful</strong>. De maatgids wordt dan opnieuw opgehaald en gecontroleerd. Je prijzen, teksten en instellingen blijven ongewijzigd.</p>

<h2>Eigen webshop?</h2>
<p>De storefront-API geeft bij een product het veld <code>size_chart</code> met <code>status</code>, <code>fit</code>, <code>columns</code> en <code>rows</code>. Bij de status <em>blocked</em> zijn de rijen leeg. Het bestaande veld <code>size_guide</code> met de ruwe Printful-data blijft ongewijzigd.</p>
$html$,
  3
)
on conflict (doc_level, slug) do update set
  context_path = excluded.context_path,
  title = excluded.title,
  excerpt = excluded.excerpt,
  content = excluded.content,
  sort_order = excluded.sort_order,
  updated_at = now();

update public.doc_articles
set content = replace(
      content,
      'De maatgids uit Printful (cm en inch) wordt automatisch meegenomen als die bestaat.',
      'De maatgids uit Printful wordt automatisch meegenomen als die bestaat, omgerekend naar een vaste maattabel in cm en gecontroleerd. Je vindt hem in het product onder de tab <strong>Maattabel</strong>.'
    ),
    updated_at = now()
where doc_level = 'tenant'
  and slug = 'printful-print-on-demand-koppelen'
  and content like '%De maatgids uit Printful (cm en inch) wordt automatisch meegenomen als die bestaat.%';
