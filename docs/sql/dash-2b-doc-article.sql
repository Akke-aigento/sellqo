-- DASH-2b — helpartikel "Je cockpit (dashboard)". Gedraaid via query_database op 21-10-2026.
-- context_path /admin/dashboard en niet /admin: de hulpchat matcht met startsWith, en /admin
-- zou dan op elke adminpagina meetellen. Idempotent via (doc_level, slug).
insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, content, tags, context_path, sort_order, is_published)
values (
  'a0000001-0000-0000-0000-000000000008',
  'tenant',
  'Je cockpit: het dashboard',
  'cockpit-dashboard',
  'Wat elke kaart op je dashboard toont, waar de cijfers vandaan komen en hoe je de cockpit aanpast.',
  $html$
<p>Je dashboard heet de <strong>cockpit</strong>. Het toont wat er vandaag in je winkel gebeurt. Welke kaarten je ziet, hangt af van je pakket en add-ons (webshop, horeca of events) en van je rol.</p>

<h2>De kaarten</h2>
<ul>
  <li><strong>Omzet vandaag</strong>: je omzet tot nu, met een lijn per uur naast dezelfde weekdag vorige week tot hetzelfde tijdstip. Ook het aantal bestellingen, het gemiddelde bedrag en het aantal nieuwe klanten van vandaag.</li>
  <li><strong>Maanddoel en records</strong>: een omzetdoel voor de maand, voor de hele winkel. Alleen een beheerder kan het instellen of wijzigen. Eronder je reeks (dagen op rij met minstens één verkoop) en je records per weekdag.</li>
  <li><strong>Te doen</strong>: bestellingen die op verzending wachten, ongelezen berichten, offertes die op antwoord wachten en producten die bijna op zijn. Tik op een regel om naar de juiste pagina te gaan.</li>
  <li><strong>Kanaalmix</strong>: je omzet deze maand per kanaal (webshop, kassa, bol en andere), vergeleken met dezelfde dagen vorige maand.</li>
  <li><strong>Net binnen</strong>: de laatste bestellingen, kassatickets, nieuwe klanten, reviews en check-ins van de afgelopen twee dagen. Deze lijst ververst elke minuut.</li>
  <li><strong>Toppers</strong>: je best verkochte producten van de afgelopen week (bij horeca: van vandaag), uit de webshop en de kassa samen.</li>
</ul>

<h2>Verkoop je tickets?</h2>
<p>Dan staat je <strong>volgende event</strong> bovenaan: hoeveel dagen het nog duurt, hoeveel tickets er verkocht zijn tegenover de capaciteit en, op de dag zelf, hoeveel mensen al binnen zijn. De knop <strong>Tickets scannen</strong> staat er altijd, ook buiten eventdagen.</p>

<h2>Heb je een horecazaak?</h2>
<ul>
  <li><strong>Keuken nu</strong>: de open bonnen per stap (nieuw, bereiden, klaar), met hoe lang elke bon al wacht. Dezelfde bonnen als op het keukenscherm.</li>
  <li><strong>Drukte vandaag</strong>: je verkopen per kwartier, naast wat je op dezelfde weekdag de laatste vier weken gemiddeld verkocht. Zo zie je wanneer de spits komt.</li>
  <li><strong>Op voor vandaag</strong>: zet een gerecht met één tik op uitverkocht, online, aan tafel en aan de kassa tegelijk. Om 05:00 de volgende ochtend staat het automatisch weer aan.</li>
  <li><strong>Leveringen onderweg</strong>: de leveringen die nog niet afgewerkt zijn, met adres en gevraagd tijdstip.</li>
</ul>

<h2>Waar komen de cijfers vandaan?</h2>
<p>Omzet telt betaalde, niet-geannuleerde bestellingen en kassatickets. Een kassaticket dat bij een bestelling hoort, telt maar één keer. Records en reeksen kijken tot 12 maanden terug. Een record per weekdag verschijnt pas als er minstens drie eerdere dagen van die weekdag zijn.</p>

<h2>De cockpit aanpassen</h2>
<p>Klik bovenaan op <strong>Cockpit aanpassen</strong>. Zet kaarten aan of uit en schuif ze met de pijltjes op of neer. Je keuze geldt alleen voor jou; met <strong>Standaard terugzetten</strong> krijg je de oorspronkelijke volgorde terug.</p>
$html$,
  array['dashboard', 'cockpit', 'omzet', 'maanddoel', 'events', 'horeca'],
  '/admin/dashboard',
  1,
  true
)
on conflict (doc_level, slug) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  content = excluded.content,
  tags = excluded.tags,
  context_path = excluded.context_path,
  updated_at = now();
