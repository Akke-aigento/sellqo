-- KAART-3 — helpartikel "De Kaart" bijgewerkt (paneel per product, volgorde slepen, maat
-- toevoegen). Draaien via query_database ná de go op KAART-3. Idempotent via (doc_level, slug).
insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, content, tags, context_path, sort_order, is_published)
values (
  'a0000001-0000-0000-0000-000000000006',
  'tenant',
  'De Kaart: je producten snel aanmaken en bewerken',
  'horeca-kaart',
  'Onder Bestellen › Kaart zet je je hele kaart in een paar minuten klaar: naam en prijs, btw per categorie, een lijst plakken, de startkaart of een foto van je menukaart.',
  $html$
<p>Onder <strong>Bestellen › Kaart</strong> staan al je producten per categorie op één scherm. Het zijn dezelfde producten als in je kassa, op je QR-menu en in je webshop: pas je hier iets aan, dan geldt het overal.</p>

<h2>Een product toevoegen</h2>
<ol>
  <li>Typ onderaan een categorie de naam en de prijs, bijvoorbeeld <em>Duvel 4,50</em>, en druk op Enter.</li>
  <li>Het product staat meteen op de kaart, met de btw van die categorie.</li>
</ol>
<p>Elke maat is een apart product (bv. <em>Pils 25cl</em> en <em>Pils 33cl</em>). Zo tik je aan de toog sneller en zie je op je rapporten precies wat er verkocht is.</p>

<h2>Snel aanpassen in de lijst</h2>
<ul>
  <li><strong>Prijs</strong>: klik erin, pas aan en druk op Enter (Escape zet terug).</li>
  <li><strong>Schakelaar</strong>: het product op de kaart zetten of eraf halen.</li>
  <li><strong>Op voor vandaag</strong> (het rondje met de streep): het product is overal uitverkocht tot morgenvroeg 5 uur.</li>
</ul>

<h2>Alles van één product: tik op de naam</h2>
<p>Tik op de naam van een product en er opent een paneel naast je kaart (op je gsm over het hele scherm). Alles wat je daar aanpast, wordt meteen bewaard:</p>
<ul>
  <li><strong>Prijs</strong> met de knoppen <strong>−</strong> en <strong>+</strong> (telkens 10 cent), of typ de prijs.</li>
  <li><strong>Op voor vandaag</strong> en <strong>Op de kaart</strong>.</li>
  <li><strong>Categorie</strong>: tik een andere aan; het product neemt dan ook de btw van die categorie over.</li>
  <li><strong>Foto</strong>: op je gsm of tablet opent meteen de camera.</li>
  <li><strong>Waar te koop</strong>: webshop, bestellen aan tafel, zichtbaar op het QR-menu, kassa.</li>
  <li><strong>Korte beschrijving</strong> voor het QR-menu en de webshop.</li>
  <li><strong>Extra's en allergenen</strong> (ingeklapt; tik om te openen).</li>
  <li><strong>Maat of kopie toevoegen</strong>: bv. Pils 33cl naast Pils 25cl. Het nieuwe product komt net eronder, met dezelfde categorie, btw, foto, extra's en allergenen; je vult enkel naam en prijs in.</li>
  <li>Onder <strong>Meer</strong>: de btw van dit ene product (meestal stel je de btw per categorie in).</li>
</ul>

<h2>De volgorde kies je zelf</h2>
<p>Sleep een product aan het greepje links (de zes puntjes) naar boven of beneden binnen zijn categorie. Categorieën sleep je aan het greepje in hun kop. Dit is ook de volgorde op SellQo Kassa: zet je meest getapte dranken bovenaan. De volgorde van de categorieën geldt ook voor je webshop en QR-menu.</p>

<h2>Btw per categorie</h2>
<p>Klik op het tandwiel naast een categorie en kies de btw <em>ter plaatse</em> en <em>bij meenemen</em>. Nieuwe producten in die categorie nemen die tarieven over. Bestaande producten veranderen pas als je op <strong>Toepassen op de producten in deze categorie</strong> klikt. Laat de tarieven nakijken door je boekhouder.</p>

<h2>Veel tegelijk</h2>
<ul>
  <li><strong>Selecteren</strong>: vink producten aan (of alles in een categorie). Onderaan verschijnt een balk: prijs aanpassen (± €, ± % of een vaste prijs), naar een andere categorie, op of van de kaart, op of terug te koop.</li>
  <li><strong>Lijst plakken</strong>: plak een lijst uit Excel, een mail of je oude kassa, één product per lijn met de prijs erachter. Een kopje zoals <em>Bieren:</em> zet de categorie.</li>
  <li><strong>Startkaart</strong>: vink de klassiekers van een café aan (dranken van het vat, bieren, frisdranken, warme dranken, wijn, sterke drank, snacks) en vul de prijzen in.</li>
  <li><strong>Foto van je kaart</strong>: neem een foto van je menukaart of krijtbord. De AI leest namen, prijzen en kopjes. Dat kost 5 AI-credits per foto, enkel als het lezen lukt.</li>
</ul>
<p>Bij plakken, de startkaart en de foto zie je altijd eerst een voorbeeld. Je kan alles nog aanpassen, en producten die al op je kaart staan, worden uitgevinkt. Pas als je op <strong>Toevoegen</strong> klikt, wordt er iets aangemaakt. Voor een nieuwe categorie kies je in het voorbeeld de btw-soort: dranken met alcohol, zonder alcohol, of eten.</p>
$html$,
  array['horeca','kaart','menu','producten','btw','startkaart','ai','volgorde','maat','foto'],
  '/admin/bestellen',
  3,
  true
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
  tags = excluded.tags, context_path = excluded.context_path, sort_order = excluded.sort_order,
  updated_at = now();
