-- HORECA-STAAT-1 — wegwerp-doc_articles voor 20261104160000_horeca_staat_1_docs.sql. doc_articles bestaat al
-- (10_uren_docs_prelude.sql); de artikels bestaan al uit eerdere preludes/migraties en krijgen hier de live
-- ankers (nageteld op 4-11-2026: elk precies één keer), met wat tekst errond. run.sh draait de migratie twee
-- keer en vergelijkt de md5 per artikel (test_horeca_staat_docs.sql).
create table if not exists public.horeca_staat_docs_md5 (run int, slug text, md5 text);
insert into public.doc_articles (doc_level, title, slug, content) values
 ('tenant', 'Het Nu-paneel: schakelaars voor tijdens de dienst', 'nu-paneel', $c$<ul>
  <li><strong>Bestellen via QR aan tafel</strong>: wisselt tussen bestellen aan tafel en het QR-menu enkel om te bekijken.</li>
  <li><strong>Keuken pauzeren</strong>: 15, 30 of 60 minuten (of tot het einde van de dag) geen nieuwe online bestellingen voor afhalen en leveren. Bestellen aan tafel blijft werken. Je ziet de tegel enkel als online bestellen aanstaat of er al een pauze loopt; tik op de gepauzeerde tegel om te hervatten. Enkel de zaakvoerder.</li>
  <li><strong>Uitzonderlijk dicht</strong>: zet je zaak vandaag dicht, met een korte reden als je wil (bv. personeel ziek). Je website toont dan vandaag "gesloten", en online reserveren, afhalen en leveren voor vandaag kunnen niet meer. Bestellen via de QR aan tafel blijft wel mogelijk; zet daarvoor ook <strong>Bestellen via QR aan tafel</strong> uit. Tik nog eens om vandaag weer open te gaan. Valt vandaag in een sluitingsperiode, dan pas je die aan bij je openingsuren.</li>
</ul>$c$),
 ('tenant', 'Keukenscherm en bestellen aan tafel', 'keukenscherm-en-tafelbestelling', $c$<ul>
  <li>Met <strong>pauze</strong> neem je 15, 30 of 60 minuten (of tot het einde van de dag) geen nieuwe online bestellingen voor afhalen en leveren aan; bestellen aan tafel blijft werken. Dezelfde pauze staat als tegel in het Nu-paneel.</li>
</ul>
<ul>
  <li>Met <strong>Ik zit niet meer aan tafel</strong> keert hij terug naar je gewone online kaart.</li>
  <li>Gerechten die je enkel aan tafel verkoopt, tonen online: <em>Dit kan je niet online bestellen.</em></li>
</ul>$c$),
 ('tenant', 'Openingsuren instellen', 'openingsuren-instellen', $c$<h2>Uitzonderlijke sluitingsdagen</h2>
<p>Klik op <strong>Toevoegen</strong>. Voorbije sluitingen verdwijnen vanzelf. Op die dagen kan er niet afgehaald, geleverd of online gereserveerd worden. Bestellen aan tafel via de QR-code blijft werken: dan zit je gast al in de zaak.</p>
<ul>
  <li>Heb je op je homepage de sectie <strong>Openingsuren en contact</strong>, dan toont die je openingsuren.</li>
  <li>Vul je niets in, dan toont je website ook niets.</li>
</ul>$c$),
 ('tenant', 'Bestellingen via de QR op de tafelrekening', 'qr-tafelrekening', $c$<ol>
  <li>Hij kan daarna gewoon nog iets bestellen. Elke bestelling komt apart binnen.</li>
</ol>
<p>Producten die op zijn of die je niet aan tafel verkoopt, kan hij niet doorgeven; hij krijgt meteen een melding. Een kortingscode kan hij aan tafel niet invullen.</p>$c$)
on conflict (doc_level, slug) do update set content = excluded.content;
