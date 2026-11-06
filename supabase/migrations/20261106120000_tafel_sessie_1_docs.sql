-- TAFEL-SESSIE-1 — helpartikel "Bestellingen via de QR op de tafelrekening" (qr-tafelrekening) aangevuld onder
-- "Wat de gast ziet": de balk "Terug naar tafel" op elke pagina, een eigen mandje per tafel, en dat de gewone
-- menu-QR nooit automatisch het bestelmenu van de vorige tafel opent.
--
-- Anker: "<li>Hij kan daarna gewoon nog iets bestellen. Elke bestelling komt apart binnen.</li>" uit de
-- oorspronkelijke tekst (20261028121000_qr_rekening_1_docs.sql); geen latere migratie in de repo raakt die regel.
-- NIET live nagetrokken (geen databanktoegang in deze run): vóór het draaien read-only nakijken dat het anker
-- precies één keer in het artikel staat (query onderaan). Staat het er niet, dan doet deze update niets.
--
-- Bewust een geankerde replace() en geen INSERT ... ON CONFLICT (doc_level, slug) DO UPDATE: het artikel bestaat al
-- en zijn huidige tekst is in zeven migraties stap voor stap opgebouwd. Een volledige nieuwe content zou wijzigingen
-- die enkel live staan stil overschrijven. Zelfde werkwijze als HORECA-STAAT-1 (20261104160000).
--
-- PAS DRAAIEN NA de deploy van storefront-api (TAFEL-SESSIE-1) en de push + deploy van sellqo-storefront
-- (anders beschrijft het artikel wat nog niet live is).
-- Idempotent: raakt enkel de rij waarin het anker precies één keer voorkomt én de nieuwe tekst nog niet staat.
-- Snapshot vooraf, één keer (create table if not exists).
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content, updated_at = now()
--     from snapshots.sellqo_20261106_doc_tafel_sessie_1 s where d.id = s.id;
--
-- Natrek vooraf (read-only):
--   select md5(content),
--          (length(content) - length(replace(content, '<li>Hij kan daarna gewoon nog iets bestellen. Elke bestelling komt apart binnen.</li>', '')))
--            / length('<li>Hij kan daarna gewoon nog iets bestellen. Elke bestelling komt apart binnen.</li>') as anker,
--          position('Terug naar tafel' in content) as al_gedaan
--     from public.doc_articles where doc_level = 'tenant' and slug = 'qr-tafelrekening';
--   → verwacht: anker = 1, al_gedaan = 0.

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261106_doc_tafel_sessie_1 as
  select id, doc_level, slug, title, excerpt, tags, content, md5(content) as md5, now() as taken_at
    from public.doc_articles where doc_level = 'tenant' and slug = 'qr-tafelrekening';
revoke all on snapshots.sellqo_20261106_doc_tafel_sessie_1 from anon, authenticated;

update public.doc_articles set content = replace(content,
  $a$<li>Hij kan daarna gewoon nog iets bestellen. Elke bestelling komt apart binnen.</li>$a$,
  $b$<li>Hij kan daarna gewoon nog iets bestellen. Elke bestelling komt apart binnen.</li>
  <li>Kijkt hij intussen elders op je website (de homepage, een product, het gewone menu), dan staat bovenaan elke pagina <strong>Terug naar tafel …</strong>. Eén tik en hij zit weer in het menu van zijn tafel; gebruik je de tafelrekening met tafels uit je zaalplan, dan staat er ook <strong>Mijn rekening</strong>. Dat blijft zo zolang zijn tafel geldig is: tot drie uur na zijn laatste scan of de laatste keer dat hij iets toevoegde.</li>
  <li>Elke tafel heeft een eigen winkelmandje. Scant iemand met dezelfde gsm een andere tafel, dan begint hij daar met een leeg mandje; wat hij aan de vorige tafel koos, komt nooit op de rekening van de nieuwe tafel. Scant hij daarna de eerste tafel opnieuw, dan vindt hij daar zijn mandje terug.</li>
  <li>Scant hij de gewone menu-QR (aan de toog, op het raam of een affiche), dan ziet hij het gewone menu, zoals elke bezoeker, en niet automatisch het bestelmenu van zijn tafel. Via <strong>Terug naar tafel</strong> bovenaan gaat hij terug.</li>$b$),
  updated_at = now()
where doc_level = 'tenant' and slug = 'qr-tafelrekening'
  and (length(content) - length(replace(content, $a$<li>Hij kan daarna gewoon nog iets bestellen. Elke bestelling komt apart binnen.</li>$a$, ''))) / length($a$<li>Hij kan daarna gewoon nog iets bestellen. Elke bestelling komt apart binnen.</li>$a$) = 1
  and position('Terug naar tafel' in content) = 0;
