-- HORECA-STAAT-1 — helpartikels bijgewerkt met de nieuwe regels (één stand voor website, menu, QR en server):
--   - vandaag dicht = ook aan tafel dicht (wie al een rekening heeft, kan nog afrekenen);
--   - keuken pauzeren = online alles stil en aan tafel enkel de keukengerechten (dranken/bar blijven);
--   - zonder weekuren toont de site een sluiting van vandaag toch.
-- Artikels: nu-paneel (2 ankers), keukenscherm-en-tafelbestelling (2), openingsuren-instellen (2),
-- qr-tafelrekening (1, het artikel over het QR-menu aan tafel; een slug "qr-menu" bestaat niet live).
-- Live nagetrokken op 4-11-2026 (read-only): elk anker staat precies één keer in zijn artikel, de nieuwe teksten
-- nog niet. md5 vooraf: nu-paneel 55b2f629693ea9cfb81dfa3c1a52fba2, keukenscherm-en-tafelbestelling
-- 54c249bb7bfade6430f0fb601a523f47, openingsuren-instellen 22abd33cb035b4c75c96add5f1110fbe,
-- qr-tafelrekening 2840e2ed426e7b25301bf4543ac4ae17.
-- PAS DRAAIEN NA de deploy van storefront-api (HORECA-STAAT-1), de push van sellqo-storefront en de publish van
-- sellqo.app (anders beschrijft het artikel wat nog niet live is).
-- Idempotent: elke replace() raakt enkel een rij waarin het anker precies één keer voorkomt én de nieuwe tekst nog
-- niet staat. Snapshot vooraf, één keer (create table if not exists).
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content from snapshots.sellqo_20261104_doc_horeca_staat_1 s where d.id = s.id;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261104_doc_horeca_staat_1 as
  select id, doc_level, slug, title, excerpt, tags, content, md5(content) as md5, now() as taken_at
    from public.doc_articles where doc_level = 'tenant'
     and slug in ('nu-paneel', 'keukenscherm-en-tafelbestelling', 'openingsuren-instellen', 'qr-tafelrekening');
revoke all on snapshots.sellqo_20261104_doc_horeca_staat_1 from anon, authenticated;

-- 1. nu-paneel — tegel Keuken pauzeren.
update public.doc_articles set content = replace(content,
  $a$<li><strong>Keuken pauzeren</strong>: 15, 30 of 60 minuten (of tot het einde van de dag) geen nieuwe online bestellingen voor afhalen en leveren. Bestellen aan tafel blijft werken. Je ziet de tegel enkel als online bestellen aanstaat of er al een pauze loopt; tik op de gepauzeerde tegel om te hervatten. Enkel de zaakvoerder.</li>$a$,
  $b$<li><strong>Keuken pauzeren</strong>: 15, 30 of 60 minuten (of tot het einde van de dag) neemt de keuken even niets aan. Online (afhalen en leveren) kan er dan niet besteld worden; aan tafel enkel de gerechten die naar een keukenpost gaan. Dranken en alles wat naar de bar gaat, blijven aan tafel bestelbaar (je posten stel je in onder <strong>Mijn zaak › Zaal &amp; keuken › Posten &amp; gangen</strong>; met een webshop- of eventspakket onder <strong>Kaart › Instellen</strong>). Heb je geen posten, dan ligt tijdens de pauze ook bestellen aan tafel stil. Gasten zien bovenaan je website en het QR-menu "Keuken even dicht tot 21:53", en bij een keukengerecht waarom het nu niet kan. Bovenaan het Nu-paneel staat wat er stilligt, met <strong>Hervatten</strong>. Je ziet de tegel als er online of aan tafel besteld kan worden, of als er al een pauze loopt. Enkel de zaakvoerder.</li>$b$)
where doc_level = 'tenant' and slug = 'nu-paneel'
  and (length(content) - length(replace(content, $a$<li><strong>Keuken pauzeren</strong>: 15, 30 of 60 minuten (of tot het einde van de dag) geen nieuwe online bestellingen voor afhalen en leveren. Bestellen aan tafel blijft werken. Je ziet de tegel enkel als online bestellen aanstaat of er al een pauze loopt; tik op de gepauzeerde tegel om te hervatten. Enkel de zaakvoerder.</li>$a$, ''))) / length($a$<li><strong>Keuken pauzeren</strong>: 15, 30 of 60 minuten (of tot het einde van de dag) geen nieuwe online bestellingen voor afhalen en leveren. Bestellen aan tafel blijft werken. Je ziet de tegel enkel als online bestellen aanstaat of er al een pauze loopt; tik op de gepauzeerde tegel om te hervatten. Enkel de zaakvoerder.</li>$a$) = 1
  and position('neemt de keuken even niets aan' in content) = 0;

-- 2. nu-paneel — tegel Uitzonderlijk dicht: ook aan tafel dicht.
update public.doc_articles set content = replace(content,
  $a$Je website toont dan vandaag "gesloten", en online reserveren, afhalen en leveren voor vandaag kunnen niet meer. Bestellen via de QR aan tafel blijft wel mogelijk; zet daarvoor ook <strong>Bestellen via QR aan tafel</strong> uit. Tik nog eens om vandaag weer open te gaan.$a$,
  $b$Je website, je menukaart en het QR-menu tonen dan bovenaan "Vandaag gesloten" met je reden, ook als je geen openingsuren invulde. Online bestellen, afhalen, leveren en bestellen via de QR aan tafel kunnen vandaag niet, online reserveren voor vandaag ook niet. Gasten die al een rekening hebben, kunnen nog afrekenen en de rekening vragen. Bovenaan het Nu-paneel staat dan <em>Je zaak staat vandaag dicht</em>, met <strong>Toch open vandaag</strong>; je kan ook nog eens op de tegel tikken.$b$)
where doc_level = 'tenant' and slug = 'nu-paneel'
  and (length(content) - length(replace(content, $a$Je website toont dan vandaag "gesloten", en online reserveren, afhalen en leveren voor vandaag kunnen niet meer. Bestellen via de QR aan tafel blijft wel mogelijk; zet daarvoor ook <strong>Bestellen via QR aan tafel</strong> uit. Tik nog eens om vandaag weer open te gaan.$a$, ''))) / length($a$Je website toont dan vandaag "gesloten", en online reserveren, afhalen en leveren voor vandaag kunnen niet meer. Bestellen via de QR aan tafel blijft wel mogelijk; zet daarvoor ook <strong>Bestellen via QR aan tafel</strong> uit. Tik nog eens om vandaag weer open te gaan.$a$) = 1
  and position('<strong>Toch open vandaag</strong>' in content) = 0;

-- 3. keukenscherm-en-tafelbestelling — wat de pauze doet.
update public.doc_articles set content = replace(content,
  $a$Met <strong>pauze</strong> neem je 15, 30 of 60 minuten (of tot het einde van de dag) geen nieuwe online bestellingen voor afhalen en leveren aan; bestellen aan tafel blijft werken.$a$,
  $b$Met <strong>Keuken pauzeren</strong> neemt de keuken 15, 30 of 60 minuten (of tot het einde van de dag) niets aan: geen online bestellingen voor afhalen en leveren, en aan tafel geen gerechten die naar een keukenpost gaan. Dranken en alles wat naar de bar gaat, blijven aan tafel bestelbaar. Zonder bereidingsposten ligt ook bestellen aan tafel stil.$b$)
where doc_level = 'tenant' and slug = 'keukenscherm-en-tafelbestelling'
  and (length(content) - length(replace(content, $a$Met <strong>pauze</strong> neem je 15, 30 of 60 minuten (of tot het einde van de dag) geen nieuwe online bestellingen voor afhalen en leveren aan; bestellen aan tafel blijft werken.$a$, ''))) / length($a$Met <strong>pauze</strong> neem je 15, 30 of 60 minuten (of tot het einde van de dag) geen nieuwe online bestellingen voor afhalen en leveren aan; bestellen aan tafel blijft werken.$a$) = 1
  and position('Zonder bereidingsposten ligt ook bestellen aan tafel stil.' in content) = 0;

-- 4. keukenscherm-en-tafelbestelling — bestellen aan tafel: dicht, pauze, zone.
update public.doc_articles set content = replace(content,
  $a$<li>Gerechten die je enkel aan tafel verkoopt, tonen online: <em>Dit kan je niet online bestellen.</em></li>$a$,
  $a$<li>Gerechten die je enkel aan tafel verkoopt, tonen online: <em>Dit kan je niet online bestellen.</em></li>$a$ || $b$
  <li>Is je zaak vandaag dicht, de zone van zijn tafel dicht, of ben je buiten je uren terwijl <em>Bestellen buiten de openingsuren</em> uit staat, dan ziet hij dat bovenaan het menu en staat er nergens een <strong>+</strong>. Tijdens een keukenpauze staat de <strong>+</strong> enkel bij wat niet naar de keuken gaat.</li>$b$)
where doc_level = 'tenant' and slug = 'keukenscherm-en-tafelbestelling'
  and (length(content) - length(replace(content, $a$<li>Gerechten die je enkel aan tafel verkoopt, tonen online: <em>Dit kan je niet online bestellen.</em></li>$a$, ''))) / length($a$<li>Gerechten die je enkel aan tafel verkoopt, tonen online: <em>Dit kan je niet online bestellen.</em></li>$a$) = 1
  and position('Tijdens een keukenpauze staat de <strong>+</strong>' in content) = 0;

-- 5. openingsuren-instellen — sluitingsdagen gelden ook aan tafel.
update public.doc_articles set content = replace(content,
  $a$Op die dagen kan er niet afgehaald, geleverd of online gereserveerd worden. Bestellen aan tafel via de QR-code blijft werken: dan zit je gast al in de zaak.$a$,
  $b$Op die dagen kan er niet besteld worden: niet online (afhalen, leveren, verzenden), niet via de QR-code aan tafel, en online reserveren voor die dag ook niet. Je website, je menukaart en het QR-menu tonen bovenaan "Vandaag gesloten" met je reden. Gasten die al een rekening hebben, kunnen nog afrekenen.$b$)
where doc_level = 'tenant' and slug = 'openingsuren-instellen'
  and (length(content) - length(replace(content, $a$Op die dagen kan er niet afgehaald, geleverd of online gereserveerd worden. Bestellen aan tafel via de QR-code blijft werken: dan zit je gast al in de zaak.$a$, ''))) / length($a$Op die dagen kan er niet afgehaald, geleverd of online gereserveerd worden. Bestellen aan tafel via de QR-code blijft werken: dan zit je gast al in de zaak.$a$) = 1
  and position('niet via de QR-code aan tafel, en online reserveren voor die dag ook niet' in content) = 0;

-- 6. openingsuren-instellen — zonder weekuren toont de site een sluiting van vandaag toch.
update public.doc_articles set content = replace(content,
  $a$<li>Vul je niets in, dan toont je website ook niets.</li>$a$,
  $b$<li>Vul je niets in, dan toont je website ook niets. Een sluiting van vandaag (bijvoorbeeld via <strong>Uitzonderlijk dicht</strong> in het Nu-paneel) toont hij wel, ook zonder weekuren: bovenaan en in de voettekst.</li>$b$)
where doc_level = 'tenant' and slug = 'openingsuren-instellen'
  and (length(content) - length(replace(content, $a$<li>Vul je niets in, dan toont je website ook niets.</li>$a$, ''))) / length($a$<li>Vul je niets in, dan toont je website ook niets.</li>$a$) = 1
  and position('ook zonder weekuren: bovenaan en in de voettekst' in content) = 0;

-- 7. qr-tafelrekening — wanneer de gast niets kan doorgeven.
update public.doc_articles set content = replace(content,
  $a$<p>Producten die op zijn of die je niet aan tafel verkoopt, kan hij niet doorgeven; hij krijgt meteen een melding.$a$,
  $b$<p>Producten die op zijn of die je niet aan tafel verkoopt, kan hij niet doorgeven; hij krijgt meteen een melding. Is je zaak vandaag dicht, de zone van zijn tafel dicht of ben je buiten je uren terwijl <em>Bestellen buiten de openingsuren</em> uit staat, dan ziet hij dat bovenaan het menu en kan hij niets doorgeven; tijdens een keukenpauze enkel wat niet naar de keuken gaat (bijvoorbeeld dranken). Afrekenen blijft gewoon kunnen.$b$)
where doc_level = 'tenant' and slug = 'qr-tafelrekening'
  and (length(content) - length(replace(content, $a$<p>Producten die op zijn of die je niet aan tafel verkoopt, kan hij niet doorgeven; hij krijgt meteen een melding.$a$, ''))) / length($a$<p>Producten die op zijn of die je niet aan tafel verkoopt, kan hij niet doorgeven; hij krijgt meteen een melding.$a$) = 1
  and position('Afrekenen blijft gewoon kunnen.' in content) = 0;
