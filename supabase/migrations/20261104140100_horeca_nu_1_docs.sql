-- HORECA-NU-1 / HORECA-NU-2 — helpartikels.
--   1. Nieuw: "Het Nu-paneel: schakelaars voor tijdens de dienst" (nu-paneel), context_path /admin/dashboard.
--   2. cockpit-dashboard: de kaart "Op voor vandaag" bestaat niet meer; uitverkocht zit in het Nu-paneel.
--   3. kassa-product-aanpassen (uitverkocht op de kassa): ⋯ › Nu voor meerdere producten en de dagschotel.
--   4. keukenscherm-en-tafelbestelling (keuken pauzeren): wat de pauze doet, en dat ze ook op het Nu-paneel staat.
--   5. zaalplan-en-qr-per-tafel: een ruimte tijdelijk dicht (terras).
--   6. zaal-live-overzicht: een dichte ruimte staat gedimd met "dicht".
-- Live nagetrokken op 4-11-2026 (read-only): elk anker hieronder staat precies één keer in zijn artikel, de nieuwe
-- teksten nog niet. md5 vooraf: cockpit-dashboard c94d6ec191855fca589bbb1b506a0f25, kassa-product-aanpassen
-- 29705d9f29ff7691e420ddbbf232e528, keukenscherm-en-tafelbestelling f72f3412f4c7bd2e56fd065eb1ea964d,
-- zaalplan-en-qr-per-tafel b5102d488cae9f80c58e34c339e9c2dd, zaal-live-overzicht 8ae473f840dba3aad22c562324a93401.
-- Categorie a0000001-…006 bestaat live (zelfde als de zaal- en kassa-artikels).
-- Samenvoeging met HORECA-INSTELLINGEN-1 (4-11): het nieuwe artikel noemt de plekken van Mijn zaak (horeca-only) én
-- de oude (webshop/events). Draaien vóór 20261104150000 (die raakt andere ankers in keukenscherm/zaalplan).
-- PAS DRAAIEN NA de publish van sellqo.app met HORECA-NU-1 (anders beschrijft het artikel wat nog niet live is).
-- Idempotent: het nieuwe artikel via ON CONFLICT (doc_level, slug) DO UPDATE; elke replace() raakt enkel een rij
-- waarin het anker precies één keer voorkomt én de nieuwe tekst nog niet staat. Snapshot vooraf, één keer.
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content, excerpt = s.excerpt, tags = s.tags
--     from snapshots.sellqo_20261104_doc_horeca_nu_1 s where d.id = s.id;
--   update public.doc_articles set is_published = false where doc_level = 'tenant' and slug = 'nu-paneel';

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261104_doc_horeca_nu_1 as
  select id, doc_level, slug, title, excerpt, tags, content, md5(content) as md5, now() as taken_at
    from public.doc_articles where doc_level = 'tenant'
     and slug in ('cockpit-dashboard', 'kassa-product-aanpassen', 'keukenscherm-en-tafelbestelling', 'zaalplan-en-qr-per-tafel', 'zaal-live-overzicht');
revoke all on snapshots.sellqo_20261104_doc_horeca_nu_1 from anon, authenticated;

-- 1. Nieuw artikel
insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, context_path, sort_order, is_published, tags, content)
values (
  'a0000001-0000-0000-0000-000000000006', 'tenant',
  'Het Nu-paneel: schakelaars voor tijdens de dienst',
  'nu-paneel',
  'Bovenaan Vandaag zet je met één tik online bestellen, bestellen via de QR, de keukenpauze, uitverkocht, vandaag dicht, je zones (terras) en de dagschotel om.',
  '/admin/dashboard', 4, true, array['nu', 'uitverkocht', 'dagschotel', 'terras', 'pauze'],
  $doc$<p>Bovenaan <strong>Vandaag</strong> staat voor horecazaken het <strong>Nu-paneel</strong>: grote tegels die je tijdens de dienst met één tik omzet. Elke tegel toont hoe het nu staat (bv. <em>Online bestellen: AAN</em>) en bevestigt kort wat je wijzigde. Je ziet enkel de tegels die je zaak gebruikt en die je rol mag. Het Nu-paneel hoort bij Horeca Small en Horeca Big.</p>

<h2>De tegels</h2>
<ul>
  <li><strong>Online bestellen</strong>: afhalen en leveren via je website aan of uit. Staat je website offline of heb je nog geen betaalmethode, dan staat de tegel grijs met een link die het oplost. Enkel de zaakvoerder.</li>
  <li><strong>Bestellen via QR aan tafel</strong>: wisselt tussen bestellen aan tafel en het QR-menu enkel om te bekijken. Staat je QR-menu helemaal uit, dan zie je deze tegel niet. Hoe gasten betalen en de rest stel je in onder <strong>Mijn zaak › Je gasten › QR aan tafel</strong> (met een webshop- of eventspakket: <strong>Kaart › Instellen › QR-menu</strong>). Enkel de zaakvoerder.</li>
  <li><strong>Keuken pauzeren</strong>: 15, 30 of 60 minuten (of tot het einde van de dag) geen nieuwe online bestellingen voor afhalen en leveren. Bestellen aan tafel blijft werken. Je ziet de tegel enkel als online bestellen aanstaat of er al een pauze loopt; tik op de gepauzeerde tegel om te hervatten. Enkel de zaakvoerder.</li>
  <li><strong>Uitverkocht vandaag</strong>: zoek een gerecht of drankje en zet het met één tik op <em>Op</em> of weer terug. Het is meteen overal op: website, QR-menu en kassa. Morgen om 5 uur staat alles vanzelf terug.</li>
  <li><strong>Uitzonderlijk dicht</strong>: zet je zaak vandaag dicht, met een korte reden als je wil (bv. personeel ziek). Je website toont dan vandaag "gesloten", en online reserveren, afhalen en leveren voor vandaag kunnen niet meer. Bestellen via de QR aan tafel blijft wel mogelijk; zet daarvoor ook <strong>Bestellen via QR aan tafel</strong> uit. Tik nog eens om vandaag weer open te gaan. Valt vandaag in een sluitingsperiode, dan pas je die aan bij je openingsuren. Enkel de zaakvoerder. Vroeger sluiten (een ander sluitingsuur voor vandaag) kan hier nog niet; pas daarvoor je openingsuren aan.</li>
  <li><strong>Je zones</strong>, zoals <em>Terras</em>: heb je meer dan één ruimte op je zaalplan, dan krijgt elke ruimte een tegel. Zet je een ruimte dicht, dan zien gasten aan een tafel daar bovenaan het QR-menu dat ze gesloten is, en kunnen ze er niet bestellen of de bediening roepen. Je personeel werkt er gewoon op verder; op het zaalplan staat de ruimte gedimd met "dicht". Online reserveren verandert niet: gasten kiezen daar geen ruimte.</li>
  <li><strong>Dagschotel</strong>: kies een of meer gerechten van je kaart, of maak er snel een nieuw met naam, prijs en categorie. Je menukaart toont bovenaan "Vandaag" met de dagschotel, de homepage van een horecathema een kleine banner, en in de kassa staat hij bovenaan de kaart. De prijs is gewoon die van het product. Morgen om 5 uur vervalt de dagschotel vanzelf; met <strong>Geen dagschotel vandaag</strong> haal je hem meteen weg.</li>
</ul>

<h2>Op de kassa: ⋯ › Nu</h2>
<p>Op SellQo Kassa vind je onder <strong>⋯ › Nu</strong> de tegels voor op de vloer: uitverkocht, keuken pauzeren, je zones en de dagschotel. Een eigenaar of verantwoordelijke die aangemeld is, tikt meteen. Een andere medewerker kiest een eigenaar of verantwoordelijke die goedkeurt met zijn PIN; die PIN blijft enkel in dat scherm, tot je het verlaat of op <strong>Vergrendelen</strong> tikt. Elke wijziging wordt bewaard met wie ze deed en op welk toestel.</p>

<h2>Waar staan de instellingen?</h2>
<p>Het Nu-paneel is de snelle ingang. De instellingen zelf blijven op hun plek: online bestellen bij <strong>Website</strong>, de QR bij <strong>Mijn zaak › Je gasten › QR aan tafel</strong>, je openingsuren en sluitingsdagen bij <strong>Mijn zaak › Je zaak › Openingsuren &amp; sluitingsdagen</strong>, je ruimtes onder <strong>Zaal</strong> en je gerechten onder <strong>Kaart</strong>. Met een webshop- of eventspakket staat de QR onder <strong>Kaart › Instellen › QR-menu</strong> en staan je openingsuren bij je bedrijfsgegevens.</p>$doc$
)
on conflict (doc_level, slug) do update set
  category_id = excluded.category_id, title = excluded.title, excerpt = excluded.excerpt, context_path = excluded.context_path,
  sort_order = excluded.sort_order, tags = excluded.tags, content = excluded.content, is_published = true;

-- 2. cockpit-dashboard: "Op voor vandaag" is opgegaan in het Nu-paneel.
update public.doc_articles
   set content = replace(content,
     '<li><strong>Op voor vandaag</strong>: zet een gerecht met één tik op uitverkocht, online, aan tafel en aan de kassa tegelijk. Om 05:00 de volgende ochtend staat het automatisch weer aan.</li>',
     '<li><strong>Het Nu-paneel</strong> (bovenaan, boven de kaarten): grote tegels om tijdens de dienst met één tik online bestellen, de keukenpauze, uitverkocht vandaag, vandaag dicht, je zones en de dagschotel om te zetten. Zie het artikel <strong>Het Nu-paneel</strong>.</li>')
 where doc_level = 'tenant' and slug = 'cockpit-dashboard'
   and (length(content) - length(replace(content, '<li><strong>Op voor vandaag</strong>: zet een gerecht met één tik op uitverkocht, online, aan tafel en aan de kassa tegelijk. Om 05:00 de volgende ochtend staat het automatisch weer aan.</li>', '')))
       = length('<li><strong>Op voor vandaag</strong>: zet een gerecht met één tik op uitverkocht, online, aan tafel en aan de kassa tegelijk. Om 05:00 de volgende ochtend staat het automatisch weer aan.</li>')
   and position('<li><strong>Het Nu-paneel</strong>' in content) = 0;

-- 3. kassa-product-aanpassen: ⋯ › Nu.
update public.doc_articles
   set content = replace(content,
     '<p>Veel producten tegelijk aanpassen doe je in de admin onder <strong>Kaart</strong>.</p>',
     '<p>Wil je snel meerdere producten op of terug zetten, of de dagschotel kiezen? Tik op <strong>⋯ › Nu</strong>: daar zoek je in je kaart en zet je met één tik op of terug.</p>' || chr(10)
       || '<p>Veel producten tegelijk aanpassen doe je in de admin onder <strong>Kaart</strong>.</p>')
 where doc_level = 'tenant' and slug = 'kassa-product-aanpassen'
   and (length(content) - length(replace(content, '<p>Veel producten tegelijk aanpassen doe je in de admin onder <strong>Kaart</strong>.</p>', '')))
       = length('<p>Veel producten tegelijk aanpassen doe je in de admin onder <strong>Kaart</strong>.</p>')
   and position('<strong>⋯ › Nu</strong>' in content) = 0;

-- 4. keukenscherm-en-tafelbestelling: wat de pauze doet.
update public.doc_articles
   set content = replace(content,
     '<li>De knoppen voor automatisch printen, geluid en pauze tonen op een gsm enkel hun icoon.</li>',
     '<li>De knoppen voor automatisch printen, geluid en pauze tonen op een gsm enkel hun icoon.</li>' || chr(10)
       || '  <li>Met <strong>pauze</strong> neem je 15, 30 of 60 minuten (of tot het einde van de dag) geen nieuwe online bestellingen voor afhalen en leveren aan; bestellen aan tafel blijft werken. Dezelfde pauze staat als tegel in het Nu-paneel op Vandaag en op de kassa onder <strong>⋯ › Nu</strong>.</li>')
 where doc_level = 'tenant' and slug = 'keukenscherm-en-tafelbestelling'
   and (length(content) - length(replace(content, '<li>De knoppen voor automatisch printen, geluid en pauze tonen op een gsm enkel hun icoon.</li>', '')))
       = length('<li>De knoppen voor automatisch printen, geluid en pauze tonen op een gsm enkel hun icoon.</li>')
   and position('Nu-paneel' in content) = 0;

-- 5. zaalplan-en-qr-per-tafel: een ruimte tijdelijk dicht.
update public.doc_articles
   set content = replace(content,
     '<h2>Een tafel of ruimte verwijderen</h2>',
     '<h2>Een ruimte tijdelijk dicht (bv. het terras)</h2>' || chr(10)
       || '<p>Regent het, of is het terras even niet bediend? Zet de ruimte dicht met de tegel in het Nu-paneel op <strong>Vandaag</strong>, of op de kassa onder <strong>⋯ › Nu</strong>. Dat kan als je meer dan één ruimte hebt. Gasten aan een tafel in die ruimte zien bovenaan het QR-menu dat ze gesloten is, en kunnen er niet bestellen of de bediening roepen. Je personeel werkt er gewoon op verder: op het zaalplan staat de ruimte gedimd met "dicht". Tik nog eens om ze weer te openen. Dicht is iets anders dan verwijderen: tafels en QR-codes blijven.</p>' || chr(10)
       || chr(10) || '<h2>Een tafel of ruimte verwijderen</h2>')
 where doc_level = 'tenant' and slug = 'zaalplan-en-qr-per-tafel'
   and (length(content) - length(replace(content, '<h2>Een tafel of ruimte verwijderen</h2>', ''))) = length('<h2>Een tafel of ruimte verwijderen</h2>')
   and position('Een ruimte tijdelijk dicht' in content) = 0;

-- 6. zaal-live-overzicht: een dichte ruimte.
update public.doc_articles
   set content = replace(content,
     'Op elke bezette tafel staan het bedrag en hoeveel minuten ze open is.</li>',
     'Op elke bezette tafel staan het bedrag en hoeveel minuten ze open is.</li>' || chr(10)
       || '<li>Een ruimte die je tijdelijk dicht zette (bv. het terras, via het Nu-paneel), staat gedimd met "dicht". Gasten kunnen er niet bestellen via de QR; tafels die al open zijn, zie je gewoon.</li>')
 where doc_level = 'tenant' and slug = 'zaal-live-overzicht'
   and (length(content) - length(replace(content, 'Op elke bezette tafel staan het bedrag en hoeveel minuten ze open is.</li>', '')))
       = length('Op elke bezette tafel staan het bedrag en hoeveel minuten ze open is.</li>')
   and position('tijdelijk dicht zette' in content) = 0;
