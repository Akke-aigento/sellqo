-- TAFEL-SAMEN-1 — helpartikels bijgewerkt voor de tafelgroep (gedeeld mandje, enkel eigen lijnen, Tafel vrijgeven):
--   1. qr-tafelrekening: de regel "Elke tafel heeft een eigen winkelmandje …" (TAFEL-SESSIE-1) vervangen door het
--      gedeelde mandje, en een nieuwe sectie "Samen aan één tafel" vóór "Gasten zien het menu niet?".
--   2. qr-online-betalen: "Alles"/"Gelijk delen" gaan over de items van de gasten van nu, nooit die van vorige gasten.
--   3. zaal-live-overzicht: waarschuwingen "Open sinds gisteren" / "Lijnen van vorige gasten" en "Tafel vrijgeven";
--      Zaal is niet langer helemaal alleen-lezen.
--
-- Ankers live nagetrokken op 6-11-2026 (read-only, query_database): elk anker precies één keer, nieuwe tekst nog
-- niet aanwezig. md5 vooraf: qr-tafelrekening 2e70e14961c2f664dd021eeafae68d39, qr-online-betalen
-- a72b917de576524cdb89cc40b4245d78, zaal-live-overzicht 476d118dc15e7097f7b6ed2384fbe431.
-- Bewust geankerde replace() en geen INSERT … ON CONFLICT DO UPDATE: de artikels bestaan en zijn in meerdere
-- migraties opgebouwd; een volledige nieuwe content zou wijzigingen die enkel live staan stil overschrijven.
--
-- PAS DRAAIEN NA de migratie 20261106160000_tafel_samen_1.sql, de deploy van storefront-api (TAFEL-SAMEN-1), de
-- publish van de admin en de push + deploy van sellqo-storefront: anders beschrijft het artikel wat nog niet live is.
-- Idempotent: elke update raakt enkel een rij waarin het anker precies één keer voorkomt én de nieuwe tekst nog
-- niet staat. Snapshot vooraf, één keer (create table if not exists).
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content, updated_at = now()
--     from snapshots.sellqo_20261106_doc_tafel_samen_1 s where d.id = s.id;
--
-- Natrek vooraf (read-only), verwacht telkens anker = 1 en al_gedaan = 0:
--   select slug, md5(content),
--          (length(content) - length(replace(content, '<h2>Gasten zien het menu niet?</h2>', ''))) / length('<h2>Gasten zien het menu niet?</h2>') as anker_qr,
--          (length(content) - length(replace(content, '<h2>Wat er op de kassa gebeurt</h2>', ''))) / length('<h2>Wat er op de kassa gebeurt</h2>') as anker_pay,
--          (length(content) - length(replace(content, '<h2>Hoe actueel is het?</h2>', ''))) / length('<h2>Hoe actueel is het?</h2>') as anker_zaal,
--          position('Samen aan één tafel' in content) + position('Tafel vrijgeven' in content) + position('van de gasten van nu' in content) as al_gedaan
--     from public.doc_articles where doc_level = 'tenant' and slug in ('qr-tafelrekening', 'qr-online-betalen', 'zaal-live-overzicht');

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261106_doc_tafel_samen_1 as
  select id, doc_level, slug, title, excerpt, tags, content, md5(content) as md5, now() as taken_at
    from public.doc_articles where doc_level = 'tenant' and slug in ('qr-tafelrekening', 'qr-online-betalen', 'zaal-live-overzicht');
revoke all on snapshots.sellqo_20261106_doc_tafel_samen_1 from anon, authenticated;

-- 1a. qr-tafelrekening: eigen mandje per gsm → gedeeld mandje per tafel.
update public.doc_articles set content = replace(content,
  $a$<li>Elke tafel heeft een eigen winkelmandje. Scant iemand met dezelfde gsm een andere tafel, dan begint hij daar met een leeg mandje; wat hij aan de vorige tafel koos, komt nooit op de rekening van de nieuwe tafel. Scant hij daarna de eerste tafel opnieuw, dan vindt hij daar zijn mandje terug.</li>$a$,
  $b$<li>Iedereen aan dezelfde tafel vult één gedeeld mandje (tenzij je dat uitzet, zie hieronder). Wat een tafelgenoot toevoegt, ziet de rest binnen enkele seconden. Wie <strong>Doorgeven aan de bediening</strong> tikt, geeft het mandje door voor de hele tafel; daarna is het voor iedereen leeg. Scant iemand met dezelfde gsm een andere tafel, dan begint hij daar bij het gezelschap van die tafel; wat hij aan de vorige tafel koos, komt nooit op de rekening van de nieuwe tafel.</li>$b$),
  updated_at = now()
where doc_level = 'tenant' and slug = 'qr-tafelrekening'
  and (length(content) - length(replace(content, $a$<li>Elke tafel heeft een eigen winkelmandje. Scant iemand met dezelfde gsm een andere tafel, dan begint hij daar met een leeg mandje; wat hij aan de vorige tafel koos, komt nooit op de rekening van de nieuwe tafel. Scant hij daarna de eerste tafel opnieuw, dan vindt hij daar zijn mandje terug.</li>$a$, ''))) / length($a$<li>Elke tafel heeft een eigen winkelmandje. Scant iemand met dezelfde gsm een andere tafel, dan begint hij daar met een leeg mandje; wat hij aan de vorige tafel koos, komt nooit op de rekening van de nieuwe tafel. Scant hij daarna de eerste tafel opnieuw, dan vindt hij daar zijn mandje terug.</li>$a$) = 1
  and position('Iedereen aan dezelfde tafel vult één gedeeld mandje' in content) = 0;

-- 1b. qr-tafelrekening: nieuwe sectie "Samen aan één tafel".
update public.doc_articles set content = replace(content,
  $a$<h2>Gasten zien het menu niet?</h2>$a$,
  $b$<h2>Samen aan één tafel</h2>
<p>Met tafels uit je zaalplan (een eigen QR-code per tafel) bestelt per tafel één gezelschap. Wie de QR-code scant terwijl er al gasten zitten, sluit bij hen aan. Gasten kunnen ook een link delen met <strong>Deel met je tafel</strong>. Zitten er twee gezelschappen aan één tafel, maak er dan twee tafels van in je zaalplan (bijvoorbeeld 8a en 8b), elk met een eigen QR-code.</p>
<ul>
  <li>Eén scherm toont het gedeelde mandje, alles wat de tafel al bestelde met de stand in keuken en bar (<em>Al besteld aan tafel …</em>), en de rekening met <strong>Afrekenen</strong> of <strong>Rekening vragen</strong>. Het is op elke gsm aan de tafel hetzelfde.</li>
  <li>Gasten zien enkel wat sinds hun aankomst op de rekening kwam: hun eigen bestellingen en wat jij voor hen aantikt op de kassa. Nooit iets van vorige gasten, ook niet als de rekening van gisteren nog openstaat.</li>
  <li>Een tafel start opnieuw voor de volgende gasten na de dagreset om 05:00, zodra je hun rekening op de kassa afsluit, als je in <strong>Zaal</strong> op <strong>Tafel vrijgeven</strong> tikt, of na een tijd zonder activiteit (standaard 120 minuten) als er niets van hen meer openstaat. Scannen nieuwe gasten de QR-code terwijl de tafel al langer dan die tijd stil is, dan starten zij vers, ook als de vorige gasten nog iets openstaan hebben. Wie vertrok, sluit niet vanzelf aan bij de volgende gasten: daarvoor moet hij de QR-code opnieuw scannen. Een deellink werkt enkel zolang dezelfde gasten aan tafel zitten.</li>
  <li>Op de kassa verandert niets: het blijft één rekening per tafel. Staan er nog lijnen van vorige gasten open, dan waarschuwen <strong>Zaal</strong> en het <strong>Nu</strong>-paneel; die reken je af of verplaats je op de kassa.</li>
</ul>
<p>Het gedeelde mandje en de tijd zonder activiteit stel je in onder <strong>Mijn zaak › Je gasten › QR aan tafel</strong> (met een webshop- of eventspakket: <strong>Kaart › Instellen › QR-menu</strong>), bij <em>Op de tafelrekening</em>. Zet je het gedeelde mandje uit, dan heeft elke gsm een eigen mandje, maar ziet de tafel wel samen wat ze al bestelde.</p>

<h2>Gasten zien het menu niet?</h2>$b$),
  updated_at = now()
where doc_level = 'tenant' and slug = 'qr-tafelrekening'
  and (length(content) - length(replace(content, $a$<h2>Gasten zien het menu niet?</h2>$a$, ''))) / length($a$<h2>Gasten zien het menu niet?</h2>$a$) = 1
  and position('Samen aan één tafel' in content) = 0;

-- 2. qr-online-betalen: enkel de items van de gasten van nu.
update public.doc_articles set content = replace(content,
  $a$<h2>Wat er op de kassa gebeurt</h2>$a$,
  $b$<p>De gast ziet en betaalt enkel de items van de gasten van nu aan zijn tafel (wat sinds hun aankomst op de rekening kwam), nooit die van vorige gasten. <strong>Alles</strong> betekent dan: alles van zijn gezelschap. Staan er op dezelfde rekening nog items van vorige gasten open, dan kan <strong>Gelijk delen</strong> niet; <em>Mijn items</em> en <em>Alles</em> wel. De rest reken je af aan de kassa.</p>

<h2>Wat er op de kassa gebeurt</h2>$b$),
  updated_at = now()
where doc_level = 'tenant' and slug = 'qr-online-betalen'
  and (length(content) - length(replace(content, $a$<h2>Wat er op de kassa gebeurt</h2>$a$, ''))) / length($a$<h2>Wat er op de kassa gebeurt</h2>$a$) = 1
  and position('van de gasten van nu' in content) = 0;

-- 3a. zaal-live-overzicht: waarschuwingen en Tafel vrijgeven.
update public.doc_articles set content = replace(content,
  $a$<h2>Hoe actueel is het?</h2>$a$,
  $b$<h2>Rekeningen van vorige gasten</h2>
<p>Gasten die via de QR-code aan een tafel bestellen, zien enkel wat sinds hun aankomst op de rekening kwam. Bij een open rekening zie je daarom een gele waarschuwing als:</p>
<ul>
<li><strong>Open sinds gisteren</strong>: de rekening staat open sinds vóór 05:00 vandaag.</li>
<li><strong>Lijnen van vorige gasten open</strong>: er staan nog items van vóór de gasten die nu aan tafel zitten. Zij zien die niet en kunnen ze niet betalen.</li>
<li><strong>Geen activiteit sinds …, nog open</strong>: de QR-gasten aan deze tafel deden al lang niets meer, maar er staat nog iets van hen open. Zijn ze vertrokken zonder te betalen, tik dan op <strong>Tafel vrijgeven</strong>.</li>
</ul>
<p>Reken die items af of verplaats ze op SellQo Kassa. Bij een tafel met QR-gasten zie je ook sinds wanneer ze er zitten.</p>
<h2>Tafel vrijgeven</h2>
<p>Zijn de gasten vertrokken maar staat de tafel voor de QR-code nog op hun naam, tik dan op <strong>Tafel vrijgeven</strong>. De volgende gasten starten met een leeg mandje en een leeg overzicht. De rekening zelf blijft staan: die reken je af of verplaats je op de kassa. Een tafel komt ook vanzelf vrij om 05:00, als je de rekening van de gasten op de kassa afsluit, of na een tijd zonder activiteit als er niets van hen meer openstaat (instelbaar bij <strong>QR aan tafel</strong>).</p>
<h2>Hoe actueel is het?</h2>$b$),
  updated_at = now()
where doc_level = 'tenant' and slug = 'zaal-live-overzicht'
  and (length(content) - length(replace(content, $a$<h2>Hoe actueel is het?</h2>$a$, ''))) / length($a$<h2>Hoe actueel is het?</h2>$a$) = 1
  and position('Tafel vrijgeven' in content) = 0;

-- 3b. zaal-live-overzicht: "Zaal is alleen-lezen" klopt niet meer helemaal.
update public.doc_articles set content = replace(content,
  $a$<p>Zaal is alleen-lezen: rekeningen openen, bijboeken en afrekenen doe je op SellQo Kassa.$a$,
  $b$<p>Rekeningen openen, bijboeken en afrekenen doe je op SellQo Kassa; op Zaal kan je enkel een tafel vrijgeven voor de volgende QR-gasten.$b$),
  updated_at = now()
where doc_level = 'tenant' and slug = 'zaal-live-overzicht'
  and (length(content) - length(replace(content, $a$<p>Zaal is alleen-lezen: rekeningen openen, bijboeken en afrekenen doe je op SellQo Kassa.$a$, ''))) / length($a$<p>Zaal is alleen-lezen: rekeningen openen, bijboeken en afrekenen doe je op SellQo Kassa.$a$) = 1;
