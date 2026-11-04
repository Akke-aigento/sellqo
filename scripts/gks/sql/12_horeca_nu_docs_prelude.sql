-- HORECA-NU-1 — wegwerp-doc_articles voor 20261104140100_horeca_nu_1_docs.sql. doc_articles bestaat al
-- (10_uren_docs_prelude.sql). Elk anker zoals het live staat (nageteld op 4-11-2026: precies één keer), met wat
-- tekst errond. run.sh draait de migratie twee keer en vergelijkt de md5 per artikel (test_horeca_nu_docs.sql).
create table if not exists public.horeca_nu_docs_md5 (run int, slug text, md5 text);
insert into public.doc_articles (doc_level, title, slug, content) values
 ('tenant', 'Je cockpit: het dashboard', 'cockpit-dashboard',
  '<h2>Heb je een horecazaak?</h2>
<ul>
  <li><strong>Drukte vandaag</strong>: je verkopen per kwartier.</li>
  <li><strong>Op voor vandaag</strong>: zet een gerecht met één tik op uitverkocht, online, aan tafel en aan de kassa tegelijk. Om 05:00 de volgende ochtend staat het automatisch weer aan.</li>
  <li><strong>Leveringen onderweg</strong>: de leveringen die nog niet afgewerkt zijn.</li>
</ul>'),
 ('tenant', 'Op of nieuwe prijs, rechtstreeks op SellQo Kassa', 'kassa-product-aanpassen',
  '<ul>
  <li>Een uitverkocht product komt morgenvroeg om 5 uur vanzelf terug.</li>
</ul>
<p>Veel producten tegelijk aanpassen doe je in de admin onder <strong>Kaart</strong>.</p>
'),
 ('tenant', 'Keukenscherm en bestellen aan tafel', 'keukenscherm-en-tafelbestelling',
  '<ul>
  <li>Op een <strong>tablet of gsm</strong> wissel je tussen die kolommen met de tabbladen bovenaan.</li>
  <li>De knoppen voor automatisch printen, geluid en pauze tonen op een gsm enkel hun icoon.</li>
  <li>Werk je met SellQo Kassa, dan brengt de knop <strong>Kassa</strong> je meteen naar de kassa.</li>
</ul>'),
 ('tenant', 'Horeca-zaalplan: tafels en een QR-code per tafel', 'zaalplan-en-qr-per-tafel',
  '<h2>QR-codes per tafel</h2>
<p>Elke tafel heeft een eigen QR-code.</p>

<h2>Een tafel of ruimte verwijderen</h2>
<p>Een verwijderde tafel verdwijnt van het plan en haar QR-code werkt niet meer.</p>
'),
 ('tenant', 'Zaal: live zien welke tafels open staan', 'zaal-live-overzicht',
  '<ul>
<li>Je zaalplan, in dezelfde kleuren als op SellQo Kassa: groen is bezet, blauw is rekening gevraagd. Op elke bezette tafel staan het bedrag en hoeveel minuten ze open is.</li>
<li>Daaronder de lijst van alle open rekeningen.</li>
</ul>')
on conflict (doc_level, slug) do nothing;
