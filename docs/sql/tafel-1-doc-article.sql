-- TAFEL-1 — helpartikel "Tafels en rekeningen op de kassa". Live gedraaid op 24-10-2026 (go Akke);
-- draaien via query_database na de go op TAFEL-1. Idempotent via (doc_level, slug).
insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, content, tags, context_path, sort_order, is_published)
values (
  'a0000001-0000-0000-0000-000000000006',
  'tenant',
  'Tafels en rekeningen op SellQo Kassa',
  'kassa-tafels-rekeningen',
  'Open rekeningen per tafel of op naam, stuur rondes naar keuken en bar, annuleer, geef korting, verplaats en voeg samen.',
  $html$
<p>Op <strong>SellQo Kassa</strong> (de app, of <strong>/kassa</strong> in je browser) werk je met rekeningen. Een rekening hoort bij een tafel uit je zaalplan, of staat op een naam (bv. aan de toog).</p>

<h2>Het tafeloverzicht</h2>
<ul>
  <li><strong>Grijs</strong>: vrije tafel. <strong>Groen</strong>: er loopt een rekening; je ziet het bedrag en de minuten sinds de laatste bestelling. <strong>Blauw</strong>: de rekening is gevraagd.</li>
  <li>Rekeningen op naam staan als knoppen bovenaan. Met <strong>+ Op naam</strong> open je een nieuwe.</li>
  <li>Op een gsm kan je wisselen tussen het zaalplan en een lijst per ruimte.</li>
  <li>Je zaalplan teken je in SellQo onder <strong>Bestellen › Zaalplan</strong>.</li>
</ul>

<h2>Bestellen en versturen</h2>
<ol>
  <li>Tik een tafel aan. Onder <strong>Kaart</strong> zie je je producten met kanaal "kassa"; producten die op zijn, zijn grijs.</li>
  <li>Tik een product aan. Heeft het extra's (bv. saus, cuisson), dan kies je die eerst.</li>
  <li>Tik <strong>Verstuur</strong>. Keuken en bar krijgen elk hun eigen bon, zonder bedragen. Wat naar welke post gaat (keuken, bar, …) stel je in onder <strong>Bestellen › Posten</strong>; zonder posten komt alles op één bon. Op het keukenscherm kies je per toestel welke post het toont.</li>
</ol>
<p>Een lijn die nog niet verstuurd is, pas je vrij aan (aantal, opmerking, weghalen). Een verstuurde lijn kan je enkel nog <strong>annuleren met een reden</strong>; de keuken krijgt dan een annuleringsbon.</p>

<h2>Korting, verplaatsen en samenvoegen</h2>
<ul>
  <li><strong>Korting</strong>: tik een lijn aan en kies een percentage of <em>Van het huis</em>.</li>
  <li><strong>Verplaatsen</strong>: tik een lijn aan › Verplaatsen, kies hoeveel en naar welke tafel of rekening.</li>
  <li><strong>Hele rekening</strong>: via <em>Meer</em> verplaats je de rekening naar een andere tafel, of voeg je ze samen met een rekening die er al loopt.</li>
  <li><strong>Rekening</strong> maakt een voorlopige rekening; de tafel kleurt blauw.</li>
</ul>

<h2>Met meerdere toestellen, en zonder internet</h2>
<p>Alle toestellen van je zaak zien dezelfde rekeningen; wijzigingen verschijnen binnen een paar seconden. Valt het internet weg, dan kan je verder bestellen: bovenaan staat hoeveel handelingen nog wachten, en die gaan vanzelf door zodra de verbinding terug is. Versturen naar de keuken wacht wel op de verbinding.</p>

<h2>Geregistreerde kassa (GKS)</h2>
<p>Staat je kassa als geregistreerde kassa ingesteld, dan wordt elke ronde, elke annulering, elke verplaatsing van verstuurde lijnen en elke voorlopige rekening eerst ondertekend. Lukt dat niet, dan gebeurt er niets en zie je waarom. Hoe afrekenen werkt, lees je in <strong>Afrekenen op SellQo Kassa</strong>.</p>
$html$,
  array['kassa','horeca','tafels','rekeningen'],
  '/kassa',
  30,
  true
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
  tags = excluded.tags, context_path = excluded.context_path, sort_order = excluded.sort_order,
  updated_at = now();
