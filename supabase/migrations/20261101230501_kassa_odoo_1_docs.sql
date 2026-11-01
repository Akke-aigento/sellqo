-- KASSA-ODOO-1 — helpartikel "Kassa-omzet naar Odoo" (kassa-naar-odoo, /admin/connect).
-- Nieuw artikel in Facturatie & Boekhouding (a0000001-…-009, enkel live). Bestaat het al (eigen
-- slug), dan wordt enkel deze rij bijgewerkt (on conflict (doc_level, slug) do update). PAS DRAAIEN NA 20261101230500 en de publish van
-- de admin (de schakelaar moet zichtbaar zijn).
-- Handmatig terugdraaien: delete from public.doc_articles where doc_level = 'tenant' and slug = 'kassa-naar-odoo';

insert into public.doc_articles (doc_level, category_id, context_path, slug, title, excerpt, content, sort_order, is_published)
values ('tenant', 'a0000001-0000-0000-0000-000000000009', '/admin/connect', 'kassa-naar-odoo',
  'Kassa-omzet naar Odoo',
  'SellQo boekt elk afgesloten Z-rapport van je kassa als één boeking in Odoo: de omzet per btw-tarief, tot op de cent gelijk aan het Z-rapport.',
  $c$
<p>Werk je met SellQo Kassa en is je Odoo gekoppeld, dan kan SellQo je dagontvangsten zelf in Odoo zetten. Per afgesloten <strong>Z-rapport</strong> komt er één boeking in Odoo.</p>

<h2>Aanzetten</h2>
<ol>
  <li>Ga naar <strong>SellQo Connect › Odoo Boekhouding</strong>. De Odoo-verbinding en de facturensync moeten al werken.</li>
  <li>Zet <strong>Z-rapporten van de kassa naar Odoo</strong> aan.</li>
  <li>Kies <strong>vanaf welke bedrijfsdag</strong>. Standaard is dat de huidige bedrijfsdag van je kassa (die begint op het afkapuur, standaard 6 uur): Z-rapporten van vóór die dag blijven buiten Odoo, zodat niets dubbel komt wat je boekhouder al met de hand boekte. Kies je een dag in het verleden, dan toont SellQo eerst hoeveel Z-rapporten er dan geboekt worden en vraagt het je bevestiging.</li>
  <li>Kies eventueel een eigen <strong>kassadagboek</strong>. Laat je het leeg, dan gebruikt SellQo het verkoopdagboek van je facturen. Een apart verkoopdagboek (bv. "Kassa") houdt de nummering van je facturen en je Z-boekingen uit elkaar; dat raden we aan.</li>
  <li>Opslaan. SellQo kijkt elk uur of er nieuwe Z-rapporten zijn.</li>
</ol>
<p>Standaard staat dit uit. Zonder schakelaar en zonder startdatum boekt SellQo niets. Zet je de facturensync uit, dan gaat ook dit uit; opnieuw aanzetten begint weer bij de huidige bedrijfsdag.</p>

<h2>Wat er in Odoo komt</h2>
<ul>
  <li>Eén boeking per Z-rapport, met als nummer <em>Z-jaar-nummer</em> (bv. Z-2026-00042) en als datum de bedrijfsdag.</li>
  <li>Als klant één verzamelklant, standaard <em>Kassaverkopen — jouw winkel</em>. De naam pas je aan bij <strong>Kanaal-weergave in Odoo</strong> (kanaal Kassa (Z-rapporten)).</li>
  <li>De omzet per btw-tarief (21, 12, 6 en 0 %), met dezelfde btw-codes als je webshopfacturen: de prijs-inclusieve codes "21% incl.", "12% incl." en "6% incl.", en "0%".</li>
  <li>De btw is die van het Z-rapport: per ticket afgerond, zoals de kassa het doet. Odoo rondt per regel af. Om dezelfde btw te krijgen, verdeelt SellQo de omzet van een tarief over meerdere regels ("btw-afronding per ticket"). Het totaal per tarief blijft gelijk aan het Z-rapport.</li>
  <li>In de notitie van de boeking staan ter info de betaalwijzen, fooien, afronding contant, kas in/uit, annulaties en correcties.</li>
</ul>

<h2>Wat er niet in Odoo komt</h2>
<ul>
  <li><strong>Betalingen.</strong> SellQo boekt nooit betalingen in Odoo. Contant, kaart en de rest stem je af zoals je dat nu doet.</li>
  <li><strong>Fooien.</strong> Een fooi is geen omzet van je zaak en wordt niet geboekt.</li>
  <li>Een Z-rapport zonder omzet.</li>
</ul>

<h2>Controle en meldingen</h2>
<p>SellQo maakt de boeking eerst als concept, leest de bedragen in Odoo terug en boekt ze pas definitief als alles tot op de cent gelijk is aan het Z-rapport, per btw-tarief. Wijkt er iets af, dan blijft het concept staan en krijg je een melding. Kijk dan het concept in Odoo na (bv. een btw-code die hernoemd werd). Staat <strong>Automatisch boeken in Odoo</strong> uit, dan blijven ook kloppende boekingen concept en boekt je boekhouder ze zelf.</p>
<p>SellQo zorgt dat een Z-rapport niet dubbel geboekt wordt, ook als een run halverwege stopt: het vindt de boeking van de vorige poging terug en werkt ze af. Verwijder, annuleer of hernoem je zelf een concept in Odoo, kijk dan na wat er in Odoo staat vóór je <strong>Opnieuw proberen</strong> of <strong>Aanvaarden</strong> kiest.</p>

<h2>Als een Z-rapport niet lukt</h2>
<ul>
  <li>SellQo probeert het de eerste drie keer elk uur opnieuw, daarna één keer per dag.</li>
  <li>Na tien pogingen staat het Z-rapport op <strong>Nakijken</strong> en probeert SellQo niet meer vanzelf. Je krijgt dan een melding.</li>
  <li>Onder <strong>Laatste Z-rapporten</strong> zie je wat er misging. Boekte je de Z met de hand in Odoo, verwijder of annuleer dan eerst een eventueel concept dat SellQo maakte (SellQo toont het Odoo-id), kies <strong>Aanvaarden</strong> en geef het Odoo-nummer: SellQo bewaart wie dat deed en boekt die Z nooit meer. Is het probleem opgelost (bv. een btw-code die ontbrak), kies dan <strong>Opnieuw proberen</strong>.</li>
</ul>

<h2>Opgelet</h2>
<ul>
  <li>Maak je voor een kassaverkoop daarnaast nog een factuur in SellQo (bv. een bedrijf vraagt een factuur), dan staat die omzet twee keer in Odoo: in de Z-boeking en als factuur. Laat je boekhouder die factuur dan als "reeds in dagontvangsten" behandelen.</li>
  <li>Een retourdag (meer terug dan verkocht) komt als creditnota in Odoo.</li>
</ul>
$c$, 40, true)
on conflict (doc_level, slug) do update
  set category_id = excluded.category_id, context_path = excluded.context_path, title = excluded.title,
      excerpt = excluded.excerpt, content = excluded.content, sort_order = excluded.sort_order, updated_at = now();
