-- ZAAL-H1 — helpartikel "Zaalplan en QR-code per tafel". Nog NIET live gedraaid:
-- draaien via query_database na de go op ZAAL-H1 (ná de migratie en de deploys).
-- Let op: live bestaat al 'zaalplan-stoelkeuze' (stoelplan voor events, /admin/events/venues); daarom een
-- andere titel en een zin die het verschil uitlegt. Idempotent via (doc_level, slug). Categorie = die van "Kassa (POS) gebruiken" (zoals HORECA-0).
-- Verifiëren na het draaien: md5(content) tegen dit bestand (updated_at is geen ijkpunt).
insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, content, tags, context_path, sort_order, is_published)
values (
  'a0000001-0000-0000-0000-000000000006',
  'tenant',
  'Horeca-zaalplan: tafels en een QR-code per tafel',
  'zaalplan-en-qr-per-tafel',
  'Teken je ruimtes en tafels na, druk per tafel een eigen QR-sticker af en vervang een code als een sticker zoek is.',
  $html$
<h2>Waar vind je het zaalplan?</h2>
<p>Ga naar <strong>Bestellen → Zaalplan</strong>. Je ziet dit enkel als de horeca-module aanstaat voor je zaak.</p>
<p>Dit is het zaalplan voor je café of restaurant: tafels waaraan gasten bestellen. Verkoop je tickets met genummerde stoelen voor een event, dan gebruik je het stoelplan onder <strong>Events → Zalen</strong>; dat staat hier los van.</p>

<h2>Ruimtes</h2>
<p>Een ruimte is een deel van je zaak met een eigen plan, zoals <em>Binnen</em>, <em>Terras</em> of <em>Boven</em>. Begin met <strong>Eerste ruimte maken</strong>. Daarna kan je ruimtes toevoegen, hernoemen, groter of kleiner maken en met de pijltjes van volgorde wisselen.</p>
<p>Het plan is een raster van vakjes. Een gewone tafel neemt 2 × 2 vakjes in, een barkruk 1 vakje. Een ruimte is standaard 40 vakjes breed en 24 diep.</p>

<h2>Tafels, barkrukken en decor</h2>
<ul>
  <li><strong>Tafel toevoegen</strong>: kies een tafel, barkruk of statafel. Ze komt op de eerste vrije plek en krijgt automatisch het volgende nummer (B1, B2… voor barkrukken).</li>
  <li><strong>Toog, deur, muur…</strong>: zet de toog, deuren, muren, planten of een tekst op het plan, zodat het herkenbaar is voor je personeel. Daar kan niet aan besteld worden.</li>
  <li><strong>Sjablonen</strong>: zet in één keer een rij barkrukken met toog, een terras (bv. Ter-1 tot Ter-4) of een rij tafels neer.</li>
</ul>
<p>Op een computer of tablet klik je op een tafel om ze aan te passen: naam, soort, vorm (rond, vierkant, rechthoekig), aantal stoelen, maat en ruimte. Sleep een tafel om ze te verplaatsen; ze klikt vast op het raster. Met de pijltjestoetsen schuif je één vakje. Met <strong>Draaien</strong> draai je per 45 graden, met <strong>Dupliceren</strong> maak je een kopie met het volgende nummer.</p>
<p>Op een gsm zie je de tafels als lijst per ruimte. Tik op een tafel om naam, stoelen of QR-code aan te passen. Verslepen doe je het makkelijkst op een computer of tablet.</p>
<p>Overlappen twee items, of heeft een tafel dezelfde naam als een tafel in een andere ruimte, dan zie je een waarschuwing. De keuken ziet enkel de naam van de tafel, dus geef elke tafel liefst een unieke naam.</p>

<h2>QR-codes per tafel</h2>
<p>Elke tafel heeft een eigen QR-code. Met <strong>QR-stickers (PDF)</strong> download je een stickervel: 12 stickers per A4, met de naam van de tafel, de ruimte en je zaaknaam. Je kan alle tafels afdrukken, enkel de huidige ruimte, of in het paneel van een tafel één sticker.</p>
<ul>
  <li>Zodra je een zaalplan hebt, kan een gast enkel nog aan tafel bestellen via de QR-code van zijn tafel. Een tafelnummer intypen in de link werkt dan niet meer. Vervang dus oude tafelkaartjes met enkel een nummer door de nieuwe stickers.</li>
  <li>Sticker kwijt of misbruikt? Kies bij die tafel <strong>Nieuwe QR-code</strong>. De oude sticker werkt meteen niet meer; druk de nieuwe af en hang hem op de tafel.</li>
  <li>Bestellen aan tafel moet aanstaan onder <strong>Bestellen → QR-menu in de zaak</strong>.</li>
</ul>

<h2>Een tafel of ruimte verwijderen</h2>
<p>Een verwijderde tafel verdwijnt van het plan en haar QR-code werkt niet meer. Bestellingen die al aan die tafel gekoppeld waren, blijven bewaard. Verwijder je een ruimte, dan verdwijnen haar tafels mee.</p>
$html$,
  array['zaalplan','tafel','qr','horeca','terras'],
  '/admin/bestellen',
  5,
  true
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
  tags = excluded.tags, context_path = excluded.context_path, sort_order = excluded.sort_order,
  updated_at = now();
