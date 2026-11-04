-- UREN-1 / WEBSITE-HORECA-1 — helpartikels.
--   1. Nieuw: "Openingsuren instellen" (openingsuren-instellen), context_path Instellingen › Bedrijfsgegevens.
--   2. reservaties: online reserveren volgt "Zelfde als openingsuren" of "Eigen uren"; sluitingsdagen uit
--      Instellingen › Bedrijfsgegevens.
--   3. horeca-werkplek: Website staat in de zijbalk (na Kaart).
--   4. theme-aanpassen: ook voor horeca ("Website"), en de sectie "Openingsuren en contact" toont je openingsuren.
-- Live nagetrokken op 4-11-2026 (read-only): er bestaat geen apart artikel over afhaal-/leveruren of sluitingsdagen
-- (PAUSE-1); die uitleg zit in het nieuwe artikel. md5 vooraf: reservaties 72250dd6bdc952aff33956e53ac6f9e6,
-- horeca-werkplek 17ba93751579017fb9bb5c7dc68258b9. Categorie a0000001-…006 (Webshop) bestaat live.
--   (UREN-1b: ook laatste aankomst en bestellen buiten de openingsuren.)
-- PAS DRAAIEN NA de publish van sellqo.app met UREN-1 (anders beschrijft het artikel wat nog niet live is).
-- Idempotent: het nieuwe artikel via ON CONFLICT (doc_level, slug) DO UPDATE; elke replace() raakt enkel een rij
-- waarin het anker precies één keer voorkomt (na de eerste keer niet meer). Snapshot vooraf, één keer.
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content, excerpt = s.excerpt, tags = s.tags
--     from snapshots.sellqo_20261104_doc_uren_1 s where d.id = s.id;
--   update public.doc_articles set is_published = false where doc_level = 'tenant' and slug = 'openingsuren-instellen';

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261104_doc_uren_1 as
  select id, doc_level, slug, title, excerpt, tags, content, md5(content) as md5, now() as taken_at
    from public.doc_articles where doc_level = 'tenant' and slug in ('reservaties', 'horeca-werkplek', 'theme-aanpassen');
revoke all on snapshots.sellqo_20261104_doc_uren_1 from anon, authenticated;

-- 1. Nieuw artikel
insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, context_path, sort_order, is_published, tags, content)
values (
  'a0000001-0000-0000-0000-000000000006', 'tenant',
  'Openingsuren instellen',
  'openingsuren-instellen',
  'Je openingsuren en uitzonderlijke sluitingsdagen vul je op één plek in: Instellingen › Bedrijfsgegevens. Je website toont ze, en afhalen, leveren en online reserveren nemen ze standaard over.',
  '/admin/settings?section=company', 5, true, array['openingsuren', 'sluitingsdagen', 'vakantie', 'afhalen', 'reserveren'],
  $doc$<p>Je openingsuren staan op één plek: <strong>Instellingen › Bedrijfsgegevens</strong>, onder je adres en contactgegevens, in het blok <strong>Openingsuren</strong>. Dat kan in elk abonnement. Enkel de zaakvoerder kan ze aanpassen; je medewerkers zien ze wel.</p>

<h2>Je weekschema</h2>
<ul>
  <li>Zet per dag de schakelaar aan of uit. Een dag die uit staat, is gesloten.</li>
  <li>Per dag vul je één tot drie blokken in, bijvoorbeeld <em>11:30–14:00</em> en <em>17:30–22:00</em>. Met <strong>Blok toevoegen</strong> komt er een blok bij.</li>
  <li>Ben je tot na middernacht open, vul dan het sluitingsuur gewoon in (bijvoorbeeld <em>20:00–02:00</em>). Je ziet dan "tot na middernacht".</li>
  <li>Met <strong>Uren van maandag kopiëren naar alle open dagen</strong> neem je de uren van maandag over.</li>
</ul>
<p>Klik op <strong>Openingsuren opslaan</strong> om te bewaren.</p>

<h2>Uitzonderlijke sluitingsdagen</h2>
<p>Ga je op vakantie, is het een feestdag of ben je aan het verbouwen? Kies onder <strong>Uitzonderlijke sluitingsdagen</strong> een datum, of een begin- en einddatum voor een periode, met een korte reden als je wil (bijvoorbeeld "Kerstvakantie"), en klik op <strong>Toevoegen</strong>. Voorbije sluitingen verdwijnen vanzelf. Op die dagen kan er niet afgehaald, geleverd of online gereserveerd worden. Bestellen aan tafel via de QR-code blijft werken: dan zit je gast al in de zaak.</p>
<p>Had je vroeger sluitingsdagen ingesteld bij afhalen en leveren, dan staan die nu hier.</p>

<h2>Waar je openingsuren verschijnen</h2>
<ul>
  <li><strong>Op je website</strong> (<em>jouwzaak</em>.sellqo.shop): in de voettekst staat je week, en de eerstvolgende sluitingsdag als die binnen twee weken valt. Bovenaan je menukaart en bij het afrekenen (afhalen of leveren) zien je bezoekers "Nu open · tot 22:00" of "Gesloten · open morgen om 11:30". Zoekmachines krijgen je uren ook mee.</li>
  <li>Heb je op je homepage de sectie <strong>Openingsuren en contact</strong>, dan toont die je openingsuren. Wil je daar liever eigen tekst, kies dan bij <em>Welke uren</em> voor <em>Eigen tekst</em>.</li>
  <li>Vul je niets in, dan toont je website ook niets.</li>
</ul>

<h2>Afhalen, leveren en online reserveren</h2>
<p>Bij de tijdsloten voor afhalen en leveren (<strong>Kaart › Instellen › Webshop: afhalen &amp; leveren</strong>, bij <em>Tijdsloten</em>) en bij online reserveren (<strong>Kaart › Reservaties</strong>) kies je telkens:</p>
<ul>
  <li><strong>Zelfde als openingsuren</strong>: de tijdstippen volgen je openingsuren. Gasten kunnen online reserveren vanaf het openingsuur tot vóór het sluitingsuur.</li>
  <li><strong>Eigen uren</strong>: je vult daar aparte uren in, bijvoorbeeld als je enkel 's avonds levert.</li>
</ul>
<p>Nieuwe zaken staan standaard op <em>Zelfde als openingsuren</em>. Had je al eigen afhaal-, lever- of reservatie-uren, dan blijven die gewoon gelden (keuze <em>Eigen uren</em>). Je sluitingsdagen gelden altijd, ook bij eigen uren.</p>
<p>Bij online reserveren met <em>Zelfde als openingsuren</em> kies je onder <strong>Op tijd reserveren</strong> ook de <strong>Laatste aankomst</strong>: tot net vóór sluiting, of bijvoorbeeld 1 u 30 vóór sluiting. Ernaast staat <strong>Minstens op voorhand</strong>: hoe lang vóór het aankomstuur een gast nog online kan reserveren.</p>

<h2>Bestellen buiten je openingsuren</h2>
<ul>
  <li><strong>QR aan tafel</strong>: onder <strong>Kaart › Instellen › QR-menu</strong>, bij <em>Bestellen</em>, staat <strong>Bestellen buiten de openingsuren</strong>. Zet je het uit, dan kunnen gasten aan tafel enkel tijdens je openingsuren bestellen. Daarbuiten zien ze op de menukaart wanneer het weer kan.</li>
  <li><strong>Afhalen en leveren zonder tijdsloten</strong> ("zo snel mogelijk"): onder <strong>Tijdsloten</strong> staat <strong>Ook buiten de uren "zo snel mogelijk" bestellen</strong>. Zet je het uit, dan kan dat enkel binnen je afhaal- of leveruren; je klant ziet bij het afrekenen wanneer het weer kan. Met tijdsloten kies je altijd een tijdstip binnen de uren.</li>
</ul>
<p>Standaard staan beide aan, zoals vroeger. Heb je geen uren ingevuld, dan wordt er niets geweigerd.</p>$doc$
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, context_path = excluded.context_path, sort_order = excluded.sort_order,
  is_published = excluded.is_published, tags = excluded.tags, content = excluded.content, category_id = excluded.category_id;

-- 2. reservaties
update public.doc_articles
   set content = replace(content,
         '<li>per weekdag het eerste en het laatste aankomstuur (dagen zonder uren zijn online dicht; je sluitingsdagen gelden ook);</li>',
         '<li>welke uren: <em>Zelfde als openingsuren</em> (gasten komen aan vanaf het openingsuur tot je <em>Laatste aankomst</em>, bv. tot net vóór sluiting of 1 u 30 ervoor; je openingsuren vul je in onder <strong>Instellingen › Bedrijfsgegevens</strong>) of <em>Eigen uren</em> (per weekdag het eerste en het laatste aankomstuur; dagen zonder uren zijn online dicht). Je sluitingsdagen uit Instellingen › Bedrijfsgegevens gelden altijd;</li>'),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'reservaties'
   and (length(content) - length(replace(content, '<li>per weekdag het eerste en het laatste aankomstuur (dagen zonder uren zijn online dicht; je sluitingsdagen gelden ook);</li>', '')))
       = length('<li>per weekdag het eerste en het laatste aankomstuur (dagen zonder uren zijn online dicht; je sluitingsdagen gelden ook);</li>');

-- 3. horeca-werkplek
update public.doc_articles
   set content = replace(content,
         '<li><strong>Betalingen</strong>, <strong>Rapporten</strong> en <strong>Inkoop</strong> (leveranciers en hun facturen).</li>',
         '<li><strong>Website</strong>: het uiterlijk van je site op <em>jouwzaak</em>.sellqo.shop: thema, logo en kleuren, voettekst, pagina''s en je homepage. Je openingsuren vul je in onder <strong>Instellingen › Bedrijfsgegevens</strong>.</li>
<li><strong>Betalingen</strong>, <strong>Rapporten</strong> en <strong>Inkoop</strong> (leveranciers en hun facturen).</li>'),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'horeca-werkplek'
   and (length(content) - length(replace(content, '<li><strong>Betalingen</strong>, <strong>Rapporten</strong> en <strong>Inkoop</strong> (leveranciers en hun facturen).</li>', '')))
       = length('<li><strong>Betalingen</strong>, <strong>Rapporten</strong> en <strong>Inkoop</strong> (leveranciers en hun facturen).</li>');

-- 4. theme-aanpassen
update public.doc_articles
   set content = replace(content,
         '<h2>Theme aanpassen</h2><p>Ga naar <strong>Webshop</strong> om het uiterlijk van je shop in te stellen.</p>',
         '<h2>Theme aanpassen</h2><p>Ga naar <strong>Webshop</strong> om het uiterlijk van je shop in te stellen. Heb je een horecapakket zonder webshop, dan heet dit menu-item <strong>Website</strong> (na <strong>Kaart</strong>); je voegt er enkel secties toe die op je site werken. Verzending, retouren en webshopkortingen horen bij de webshop.</p><p>De sectie <strong>Openingsuren en contact</strong> toont de openingsuren uit <strong>Instellingen › Bedrijfsgegevens</strong>. Wil je daar eigen tekst, kies dan bij <em>Welke uren</em> voor <em>Eigen tekst</em>. Zolang je geen openingsuren invulde, toont de sectie de dagen die je er zelf intypte.</p>'),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'theme-aanpassen'
   and (length(content) - length(replace(content, '<h2>Theme aanpassen</h2><p>Ga naar <strong>Webshop</strong> om het uiterlijk van je shop in te stellen.</p>', '')))
       = length('<h2>Theme aanpassen</h2><p>Ga naar <strong>Webshop</strong> om het uiterlijk van je shop in te stellen.</p>');
