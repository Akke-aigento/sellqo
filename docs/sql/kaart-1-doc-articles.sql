-- KAART-1/2 + KASSA-0.6 — helpartikels. Draaien via query_database ná de go op de batch.
-- Idempotent via (doc_level, slug). Categorie a0000001-…006 zoals de andere horeca-artikels
-- (live nagetrokken 24-10-2026).
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

<h2>Bewerken in de lijn zelf</h2>
<ul>
  <li><strong>Naam en prijs</strong>: klik erin, pas aan en druk op Enter (Escape zet terug).</li>
  <li><strong>Schakelaar</strong>: het product op de kaart zetten of eraf halen.</li>
  <li><strong>Op voor vandaag</strong>: het product is overal uitverkocht tot morgenvroeg 5 uur.</li>
  <li><strong>Web, Tafel, Menu, Kassa</strong>: waar het product te koop of te zien is.</li>
  <li>Het <strong>potloodje</strong> opent alle instellingen (foto's, allergenen, extra's …).</li>
</ul>

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
  array['horeca','kaart','menu','producten','btw','startkaart','ai'],
  '/admin/bestellen',
  3,
  true
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
  tags = excluded.tags, context_path = excluded.context_path, sort_order = excluded.sort_order,
  updated_at = now();

insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, content, tags, context_path, sort_order, is_published)
values (
  'a0000001-0000-0000-0000-000000000006',
  'tenant',
  'Op of nieuwe prijs, rechtstreeks op SellQo Kassa',
  'kassa-product-aanpassen',
  'Druk lang op een product op de kassa om het op te zetten voor vandaag, terug te koop te zetten of de prijs aan te passen.',
  $html$
<p>Een product is op, of je wil snel een prijs aanpassen? Dat kan rechtstreeks op SellQo Kassa.</p>
<ol>
  <li>Druk lang op het product in de kaart van de kassa (met een muis: rechtsklikken).</li>
  <li>Tik op <strong>Op voor vandaag</strong> of <strong>Terug te koop</strong>, of vul een nieuwe prijs in en tik op <strong>Prijs bewaren</strong>.</li>
</ol>
<ul>
  <li>Dit mag enkel de <strong>eigenaar</strong> of een <strong>verantwoordelijke</strong> (de medewerker met de PIN op de kassa). Voor anderen gebeurt er niets bij lang drukken.</li>
  <li>Het geldt meteen voor de kassa, het QR-menu en de webshop. Andere kassatoestellen tonen het binnen enkele minuten; een product dat op is, kan intussen nergens meer besteld worden.</li>
  <li>Rekeningen die al open staan, houden de prijs waaraan het product aangeslagen werd.</li>
  <li>Elke wijziging wordt bewaard met wie ze deed en op welk toestel.</li>
  <li>Een uitverkocht product komt morgenvroeg om 5 uur vanzelf terug.</li>
</ul>
<p>Veel producten tegelijk aanpassen doe je in de admin onder <strong>Bestellen › Kaart</strong>.</p>
$html$,
  array['kassa','horeca','op','prijs','uitverkocht'],
  '/kassa',
  33,
  true
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
  tags = excluded.tags, context_path = excluded.context_path, sort_order = excluded.sort_order,
  updated_at = now();
