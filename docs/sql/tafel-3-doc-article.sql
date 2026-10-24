-- TAFEL-3 — helpartikel "Toog, kas en rapporten op SellQo Kassa". Live gedraaid op 24-10-2026 (go Akke);
-- draaien via query_database na de go op TAFEL-3. Idempotent via (doc_level, slug).
-- Categorie a0000001-…006 (Webshop), zoals de andere kassa-artikels (live nagetrokken 24-10).
insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, content, tags, context_path, sort_order, is_published)
values (
  'a0000001-0000-0000-0000-000000000006',
  'tenant',
  'Toog, kas en X/Z-rapporten op SellQo Kassa',
  'kassa-toog-kas-rapporten',
  'Verkoop aan de toog zonder tafel, boek geld in of uit de lade, tel je kas bij elke shift en sluit je dag af met een Z-rapport.',
  $html$
<p>SellQo Kassa heeft vier tabbladen: <strong>Tafels</strong>, <strong>Toog</strong>, <strong>Kas</strong> en <strong>Rapporten</strong>.</p>

<h2>Verkopen aan de toog</h2>
<ol>
  <li>Tik op <strong>Toog</strong>. Er opent meteen een nieuwe verkoop.</li>
  <li>Kies bovenaan <strong>Ter plaatse</strong> of <strong>Meenemen</strong>. De kassa onthoudt je laatste keuze op dit toestel.</li>
  <li>Tik je producten aan. Korting of "van het huis" geef je door een lijn aan te tikken.</li>
  <li>Tik op <strong>Afrekenen</strong>. Na het betalen staat er meteen een nieuwe, lege verkoop klaar voor de volgende klant.</li>
</ol>
<ul>
  <li><strong>Btw bij meenemen.</strong> Vul bij een product onder <em>Btw bij meenemen</em> het tarief in dat geldt als de klant het meeneemt, bijvoorbeeld 6 % voor een afhaalmaaltijd. Laat je het leeg, dan geldt het gewone tarief. Het bedrag dat de klant betaalt, verandert niet.</li>
  <li><strong>Keukenbon.</strong> Staat <em>Keukenbon</em> aan, dan krijgt je keuken bij het afrekenen een bon (enkel voor wat niet naar een bar-post gaat). Verkoop je enkel dranken, zet het dan uit.</li>
  <li>Een lege verkoop verdwijnt vanzelf als je terug gaat. Een toogverkoop kan je niet naar een tafel verplaatsen of splitsen.</li>
</ul>

<h2>Kas</h2>
<ul>
  <li><strong>Kas in / Kas uit</strong>: boek geld dat je in de lade legt of eruit neemt, altijd met een reden (wisselgeld, een aankoop, naar de bank …).</li>
  <li><strong>Shift openen</strong>: tel het geld in de lade en vul het totaal in. Begin je zonder telling, dan opent de eerste verkoop zelf een shift met beginkas € 0.</li>
  <li><strong>Shift sluiten</strong>: tel opnieuw. De kassa toont wat er volgens de verkopen en kasbewegingen in de lade hoort, wat je telde, en het verschil.</li>
</ul>

<h2>X- en Z-rapporten</h2>
<ul>
  <li>Het <strong>X-rapport</strong> is een tussenstand van vandaag. Iedereen mag het maken, zo vaak je wil.</li>
  <li>Het <strong>Z-rapport</strong> sluit je dag af en krijgt een doorlopend nummer. Enkel de eigenaar of een verantwoordelijke mag het maken. Wat je daarna nog verkoopt, komt in het volgende Z-rapport.</li>
  <li>Een bedrijfsdag loopt tot 6 uur 's ochtends: een late avond hoort zo bij de dag waarop ze begon.</li>
  <li>Vergeet je een dag af te sluiten, dan maakt de kassa het Z-rapport de volgende dag zelf.</li>
  <li>Elk rapport toont je verkopen, de btw per tarief, je betaalmiddelen, fooien, kasbewegingen, de omzet per medewerker en je kastellingen. Met <strong>Afdrukken of PDF</strong> druk je het af of bewaar je het. Je vindt de laatste rapporten terug onder Rapporten.</li>
  <li>Op een geregistreerde kassa (GKS) worden het omzet- en het gebruikersrapport ook ondertekend door de zwarte doos en mee afgedrukt.</li>
</ul>
$html$,
  array['kassa','horeca','toog','kas','rapport','z-rapport','btw'],
  '/kassa',
  32,
  true
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
  tags = excluded.tags, context_path = excluded.context_path, sort_order = excluded.sort_order,
  updated_at = now();
