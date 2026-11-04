-- HORECA-INSTELLINGEN-1 — helpartikels volgen de nieuwe plekken voor horeca-only zaken.
--   Horeca zonder webshop/events: Instellingen heet "Mijn zaak" (zes groepen met tabs), Personeel en
--   Reservaties zijn eigen menu-items, Kassabeheer (/admin/pos) en Kaart › Instellen › QR-menu/posten/
--   afhalen & leveren zijn verhuisd naar Mijn zaak. Zaken met een webshop- of eventspakket houden de oude
--   plekken; daarom noemt elk bijgewerkt pad beide plekken ("met een webshop- of eventspakket: …").
--   Gedeelde artikels (btw, betaalmethode, team, thema, openingsuren) krijgen enkel een zin voor horeca-only.
-- Live nagetrokken op 4-11-2026 (read-only): elk anker staat precies één keer in zijn artikel.
--
-- Idempotent: per anker wordt eerst gekeken of de nieuwe tekst er al staat (dan overslaan); anders moet
-- het anker precies één keer voorkomen, of de migratie stopt met een fout (inhoud veranderd sinds de recon).
-- context_path enkel bijwerken waar hij nog de oude waarde heeft. Het nieuwe artikel via ON CONFLICT.
-- Snapshot één keer (create table if not exists).
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content, context_path = s.context_path
--     from snapshots.sellqo_20261104_doc_articles_horecainst1 s where d.id = s.id;
--   delete from public.doc_articles where doc_level = 'tenant' and slug = 'mijn-zaak-instellingen';

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261104_doc_articles_horecainst1 as
  select * from public.doc_articles where doc_level = 'tenant' and slug in ('betaalmethode-koppelen', 'bon-en-printers', 'btw-instellen', 'horeca-rapporten', 'horeca-werkplek', 'kassa-afrekenen', 'kassa-tafels-rekeningen', 'kassa-toestel-koppelen', 'kassapersoneel-pincodes', 'keukenscherm-en-tafelbestelling', 'meldingen-per-toestel', 'openingsuren-instellen', 'qr-online-betalen', 'qr-tafelrekening', 'reservaties', 'tafel-oproepen', 'teamleden-rollen', 'theme-aanpassen', 'zaalplan-en-qr-per-tafel');
revoke all on snapshots.sellqo_20261104_doc_articles_horecainst1 from anon, authenticated;

do $$
declare
  r record;
  c text;
  n int;
begin
  for r in
    select * from (values
    (1, 'bon-en-printers', 'staat op één plek: <strong>Kassa (POS) › Bon &amp; printers</strong>.', 'staat op één plek: <strong>Mijn zaak › Zaal &amp; keuken › Printers &amp; bon</strong> (met een webshop- of eventspakket: <strong>Kassa (POS) › Bon &amp; printers</strong>).'),
    (2, 'bon-en-printers', 'De posten zelf maak je in <strong>Kaart › Instellen › Posten</strong>.', 'De posten zelf maak je in <strong>Mijn zaak › Zaal &amp; keuken › Posten &amp; gangen</strong> (met een webshop- of eventspakket: <strong>Kaart › Instellen › Posten</strong>).'),
    (3, 'bon-en-printers', 'Daarvoor moet online betalen aan staan in <strong>Kassa (POS) › Betalen</strong>.', 'Daarvoor moet <em>De rekening online afrekenen</em> aan staan in <strong>Mijn zaak › Je gasten › QR aan tafel</strong> (met een webshop- of eventspakket: <strong>Kaart › Instellen › QR-menu</strong>).'),
    (4, 'horeca-rapporten', 'vind je onder <strong>Kassa › Personeel</strong>.', 'vind je onder <strong>Personeel › Uren</strong> (met een webshop- of eventspakket: <strong>Kassa › Personeel</strong>).'),
    (5, 'horeca-werkplek', '<li><strong>Bestellingen</strong>: alle bestellingen, van de kassa, de QR-code aan tafel en online.</li>', '<li><strong>Bestellingen</strong>: alle bestellingen, van de kassa, de QR-code aan tafel en online.</li>
<li><strong>Reservaties</strong>: je reservaties per dag en de online aanvragen die op een antwoord wachten.</li>'),
    (6, 'horeca-werkplek', '<li><strong>Kaart</strong>: al je producten en categorieën, met prijs, kostprijs en foodcost. Ernaast staan het <strong>Overzicht</strong> en je <strong>Reservaties</strong>. Wat je eenmalig instelt, staat onder <strong>Instellen</strong>: QR-menu, posten (bar, keuken), extra''s, allergenen en afhalen en leveren.</li>', '<li><strong>Kaart</strong>: al je producten en categorieën, met prijs, kostprijs en foodcost, en ernaast het <strong>Overzicht</strong>. Onder <strong>Instellen</strong> staan je extra''s en allergenen.</li>
<li><strong>Personeel</strong>: je medewerkers met hun pincode voor de kassa, hun uren en wie de zaak mag beheren.</li>'),
    (7, 'horeca-werkplek', 'Je openingsuren vul je in onder <strong>Instellingen › Bedrijfsgegevens</strong>.</li>
<li><strong>Betalingen</strong>, <strong>Rapporten</strong> en <strong>Inkoop</strong> (leveranciers en hun facturen).</li>', 'Je openingsuren vul je in onder <strong>Mijn zaak › Je zaak › Openingsuren &amp; sluitingsdagen</strong>.</li>
<li><strong>Rapporten</strong> (met daaronder <strong>Transacties</strong>: je online betalingen en uitbetalingen) en <strong>Inkoop</strong> (leveranciers en hun facturen).</li>'),
    (8, 'horeca-werkplek', '<li><strong>Instellingen</strong>: onder <strong>Instellingen › Horeca</strong> zie je al je horeca-instellingen met hun huidige stand, met een link naar de plek waar je ze aanpast. Je kassa''s, personeel en pincodes, betalen en printers vind je daar ook. Onderdelen die niet in je menu staan (zoals je SellQo-plan) vind je onder <strong>Instellingen › Meer onderdelen</strong>.</li>', '<li><strong>Mijn zaak</strong>: al je instellingen. Bovenaan staan een zoekbalk (tik bv. "fooi" of "printer") en, voor de zaakvoerder, de checklist <em>Je zaak inrichten</em>. Daaronder zes groepen, elk met tabs bovenaan: <strong>Je zaak</strong>, <strong>Je gasten</strong>, <strong>Betalen</strong>, <strong>Zaal &amp; keuken</strong>, <strong>Kassa''s &amp; toestellen</strong> en <strong>Geld &amp; boekhouding</strong>. Onder <strong>Jij</strong> staan je profiel, je eigen meldingen en je onderbalk. Je zaak, je gasten, betalen, zaal en keuken en je toestellen beheert de zaakvoerder; een medewerker ziet enkel wat hij mag openen. Onderdelen die niet in je menu staan, vind je onderaan bij <strong>Meer onderdelen</strong>. Zoeken kan ook overal met het vergrootglas bovenaan of met ⌘K / Ctrl+K.</li>'),
    (9, 'horeca-werkplek', 'Die kies je zelf in <strong>Instellingen › Mijn onderbalk</strong>.', 'Die kies je zelf in <strong>Mijn zaak › Jij › Mijn onderbalk</strong>.'),
    (10, 'kassa-afrekenen', 'Dat stel je in SellQo in onder <strong>Kassa › Betalen</strong>:', 'Dat stel je in SellQo in onder <strong>Mijn zaak › Betalen</strong> (met een webshop- of eventspakket: <strong>Kassa › Betalen</strong>):'),
    (11, 'kassa-afrekenen', 'Het rekeningnummer komt uit <strong>Instellingen › Bedrijfsgegevens</strong>;', 'Het rekeningnummer komt uit je bedrijfsgegevens (<strong>Mijn zaak › Je zaak › Gegevens</strong>; met een webshop- of eventspakket: <strong>Instellingen › Bedrijfsgegevens</strong>);'),
    (12, 'kassa-tafels-rekeningen', 'Kassa''s beheren (naam, verwijderen) doe je in SellQo onder <strong>Kassa (POS)</strong>.', 'Kassa''s beheren (naam, verwijderen) doe je in SellQo onder <strong>Mijn zaak › Kassa''s &amp; toestellen</strong> (met een webshop- of eventspakket: <strong>Kassa (POS)</strong>).'),
    (13, 'kassa-tafels-rekeningen', 'stel je per categorie in onder <strong>Kaart › Instellen › Posten</strong>,', 'stel je per categorie in onder <strong>Mijn zaak › Zaal &amp; keuken › Posten &amp; gangen</strong> (met een webshop- of eventspakket: <strong>Kaart › Instellen › Posten</strong>),'),
    (14, 'kassapersoneel-pincodes', '<p>Onder <strong>Kassa › Personeel</strong> beheer je wie aan de kassa werkt.', '<p>Onder <strong>Personeel › Medewerkers (PIN)</strong> beheer je wie aan de kassa werkt (met een webshop- of eventspakket: <strong>Kassa › Personeel</strong>).'),
    (15, 'kassapersoneel-pincodes', '<p>Onder <strong>Kassa › Personeel</strong> staat onder de medewerkers het blok <strong>Uren</strong>:', '<p>Onder <strong>Personeel › Uren</strong> (met een webshop- of eventspakket: <strong>Kassa › Personeel</strong>, onder de medewerkers) staat het blok <strong>Uren</strong>:'),
    (16, 'kassapersoneel-pincodes', 'QR uit <strong>Kassa (POS) › Kassa''s</strong> (zie', 'QR uit <strong>Mijn zaak › Kassa''s &amp; toestellen</strong> (met een webshop- of eventspakket: <strong>Kassa (POS) › Kassa''s</strong>; zie'),
    (17, 'kassapersoneel-pincodes', 'Na twee minuten zonder tikken vergrendelt de kassa vanzelf;', 'Na twee minuten zonder tikken vergrendelt de kassa vanzelf (dat pas je aan onder <strong>Mijn zaak › Kassa''s &amp; toestellen › Vergrendeltijd</strong>);'),
    (18, 'keukenscherm-en-tafelbestelling', 'kies je onder <strong>Kaart › Instellen › QR-menu</strong>. Hoe bevestigen', 'kies je onder <strong>Mijn zaak › Je gasten › QR aan tafel</strong> (met een webshop- of eventspakket: <strong>Kaart › Instellen › QR-menu</strong>). Hoe bevestigen'),
    (19, 'kassa-toestel-koppelen', 'Ga in SellQo naar <strong>Kassa (POS) › Kassa''s</strong>.', 'Ga in SellQo naar <strong>Mijn zaak › Kassa''s &amp; toestellen › Kassa''s &amp; koppelen</strong> (met een webshop- of eventspakket: <strong>Kassa (POS) › Kassa''s</strong>).'),
    (20, 'meldingen-per-toestel', 'ga naar <strong>Kassa (POS) › Kassa''s</strong> en kies <em>Dit toestel toevoegen</em>', 'ga naar <strong>Mijn zaak › Kassa''s &amp; toestellen › Meldingen per toestel</strong> (met een webshop- of eventspakket: <strong>Kassa (POS) › Kassa''s</strong>) en kies <em>Dit toestel toevoegen</em>'),
    (21, 'meldingen-per-toestel', 'Alle toestellen staan op één plek: <strong>Kassa (POS) › Kassa''s</strong>, onder <em>Meldingen per toestel</em>.', 'Alle toestellen staan op één plek: <strong>Mijn zaak › Kassa''s &amp; toestellen › Meldingen per toestel</strong> (met een webshop- of eventspakket: <strong>Kassa (POS) › Kassa''s</strong>, onder <em>Meldingen per toestel</em>).'),
    (22, 'meldingen-per-toestel', 'kies je zoals altijd onder <strong>Instellingen › Mijn meldingen</strong>.', 'kies je onder <strong>Mijn zaak › Jij › Mijn meldingen</strong> (met een webshop- of eventspakket: <strong>Instellingen › Mijn meldingen</strong>).'),
    (23, 'openingsuren-instellen', 'in het blok <strong>Openingsuren</strong>. Dat kan in elk abonnement.', 'in het blok <strong>Openingsuren</strong>. Heb je enkel het horecapakket, dan vind je ze onder <strong>Mijn zaak › Je zaak › Openingsuren &amp; sluitingsdagen</strong>. Dat kan in elk abonnement.'),
    (24, 'openingsuren-instellen', '(<strong>Kaart › Instellen › Webshop: afhalen &amp; leveren</strong>, bij <em>Tijdsloten</em>) en bij online reserveren (<strong>Kaart › Reservaties</strong>)', '(<strong>Mijn zaak › Je gasten › Afhalen &amp; leveren</strong>, bij <em>Tijdsloten</em>) en bij online reserveren (<strong>Mijn zaak › Je gasten › Reserveren</strong>; met een webshop- of eventspakket staan beide onder <strong>Kaart</strong>)'),
    (25, 'openingsuren-instellen', '<li><strong>QR aan tafel</strong>: onder <strong>Kaart › Instellen › QR-menu</strong>, bij <em>Bestellen</em>', '<li><strong>QR aan tafel</strong>: onder <strong>Mijn zaak › Je gasten › QR aan tafel</strong> (met een webshop- of eventspakket: <strong>Kaart › Instellen › QR-menu</strong>), bij <em>Bestellen</em>'),
    (26, 'qr-online-betalen', 'Dat zet je aan onder <strong>Kaart › Instellen › QR-menu</strong>, bij <em>QR aan tafel</em> ›', 'Dat zet je aan onder <strong>Mijn zaak › Je gasten › QR aan tafel</strong> (met een webshop- of eventspakket: <strong>Kaart › Instellen › QR-menu</strong>), bij <em>QR aan tafel</em> ›'),
    (27, 'qr-tafelrekening', 'Dat stel je in onder <strong>Kaart › Instellen › QR-menu</strong>, bij <em>Waar komt', 'Dat stel je in onder <strong>Mijn zaak › Je gasten › QR aan tafel</strong> (met een webshop- of eventspakket: <strong>Kaart › Instellen › QR-menu</strong>), bij <em>Waar komt'),
    (28, 'qr-tafelrekening', 'zie je dat bovenaan bij <strong>Kaart › Instellen › QR-menu</strong>, met een link', 'zie je dat bovenaan bij <strong>Mijn zaak › Je gasten › QR aan tafel</strong> (met een webshop- of eventspakket: <strong>Kaart › Instellen › QR-menu</strong>), met een link'),
    (29, 'qr-tafelrekening', 'Dat zet je aan onder <strong>Kaart › Instellen › QR-menu</strong>, bij <em>Afrekenen door de gast</em>;', 'Dat zet je aan onder <strong>Mijn zaak › Je gasten › QR aan tafel</strong> (met een webshop- of eventspakket: <strong>Kaart › Instellen › QR-menu</strong>), bij <em>Afrekenen door de gast</em>;'),
    (30, 'reservaties', 'Je beheert ze in SellQo onder <strong>Kaart › Reservaties</strong>, en op', 'Je beheert ze in SellQo onder <strong>Reservaties</strong> in het menu (met een webshop- of eventspakket: <strong>Kaart › Reservaties</strong>), en op'),
    (31, 'reservaties', '<li><strong>In het beheer:</strong> Kaart › Reservaties › <em>Nieuwe reservatie</em>.', '<li><strong>In het beheer:</strong> Reservaties › <em>Nieuwe reservatie</em> (met een webshop- of eventspakket: Kaart › Reservaties).'),
    (32, 'reservaties', 'Dat stel je in onder Kaart › Reservaties › <em>Weergave in de kassa</em>.', 'Dat stel je in onder Mijn zaak › Je gasten › Reserveren › <em>Weergave in de kassa</em> (met een webshop- of eventspakket: Kaart › Reservaties).'),
    (33, 'reservaties', 'Zet het aan onder <strong>Kaart › Reservaties › Online reserveren</strong> en kies:', 'Zet het aan onder <strong>Mijn zaak › Je gasten › Reserveren › Online reserveren</strong> (met een webshop- of eventspakket: <strong>Kaart › Reservaties › Online reserveren</strong>) en kies:'),
    (34, 'reservaties', 'je openingsuren vul je in onder <strong>Instellingen › Bedrijfsgegevens</strong>)', 'je openingsuren vul je in onder <strong>Mijn zaak › Je zaak › Openingsuren &amp; sluitingsdagen</strong>; met een webshop- of eventspakket: <strong>Instellingen › Bedrijfsgegevens</strong>)'),
    (35, 'reservaties', 'Je sluitingsdagen uit Instellingen › Bedrijfsgegevens gelden', 'Je sluitingsdagen (bij je openingsuren) gelden'),
    (36, 'reservaties', 'staat <strong>oranje</strong> bovenaan Kaart › Reservaties en in de lijst', 'staat <strong>oranje</strong> bovenaan Reservaties (met een webshop- of eventspakket: Kaart › Reservaties) en in de lijst'),
    (37, 'tafel-oproepen', 'staat (<strong>Kaart › Instellen › QR-menu</strong>).</p>', 'staat (<strong>Mijn zaak › Je gasten › QR aan tafel</strong>; met een webshop- of eventspakket: <strong>Kaart › Instellen › QR-menu</strong>).</p>'),
    (38, 'tafel-oproepen', '<p>Onder <strong>Kaart › Instellen › QR-menu</strong>, bij <em>QR aan tafel</em> › <em>De bediening roepen</em>', '<p>Onder <strong>Mijn zaak › Je gasten › QR aan tafel</strong> (met een webshop- of eventspakket: <strong>Kaart › Instellen › QR-menu</strong>), bij <em>QR aan tafel</em> › <em>De bediening roepen</em>'),
    (39, 'tafel-oproepen', 'of <strong>Kassa › Kassa''s en toestellen</strong>)', 'of <strong>Mijn zaak › Kassa''s &amp; toestellen › Meldingen per toestel</strong>; met een webshop- of eventspakket: <strong>Kassa (POS) › Kassa''s</strong>)'),
    (40, 'zaalplan-en-qr-per-tafel', 'aanstaan onder <strong>Kaart › Instellen › QR-menu in de zaak</strong>.', 'aanstaan onder <strong>Mijn zaak › Je gasten › QR aan tafel</strong> (met een webshop- of eventspakket: <strong>Kaart › Instellen › QR-menu</strong>).'),
    (41, 'theme-aanpassen', 'je merkkleur (knoppen en links) stel je in onder <strong>Instellingen › Branding</strong></li>', 'je merkkleur (knoppen en links) stel je in onder <strong>Instellingen › Branding</strong> (met enkel het horecapakket: <strong>Mijn zaak › Je zaak › Logo &amp; kleuren</strong>)</li>'),
    (42, 'theme-aanpassen', '<strong>Logo &amp; favicon</strong> — onder <strong>Instellingen › Branding</strong>,', '<strong>Logo &amp; favicon</strong> — onder <strong>Instellingen › Branding</strong> (met enkel het horecapakket: <strong>Mijn zaak › Je zaak › Logo &amp; kleuren</strong>),'),
    (43, 'theme-aanpassen', 'toont de openingsuren uit <strong>Instellingen › Bedrijfsgegevens</strong>.', 'toont de openingsuren uit <strong>Instellingen › Bedrijfsgegevens</strong> (met enkel het horecapakket: <strong>Mijn zaak › Je zaak › Openingsuren &amp; sluitingsdagen</strong>).'),
    (44, 'betaalmethode-koppelen', 'Ga naar <strong>Instellingen → Betalingen</strong> en volg', 'Ga naar <strong>Instellingen → Betalingen</strong> (met enkel het horecapakket: <strong>Mijn zaak › Betalen › Online betalen</strong>) en volg'),
    (45, 'btw-instellen', 'Ga naar <strong>Instellingen → BTW</strong>. Hier', 'Ga naar <strong>Instellingen → BTW</strong> (met enkel het horecapakket: <strong>Mijn zaak › Geld &amp; boekhouding › Btw</strong>). Hier'),
    (46, 'teamleden-rollen', '<p>Via <strong>Instellingen → Team</strong> nodig je teamleden uit per e-mail.', '<p>Via <strong>Instellingen → Team</strong> (met enkel het horecapakket: <strong>Personeel › Beheerders</strong>) nodig je teamleden uit per e-mail.')
    ) v(ord, slug, anchor, new_text) order by ord
  loop
    select content into c from public.doc_articles where doc_level = 'tenant' and slug = r.slug;
    if c is null then
      raise exception 'HORECA-INSTELLINGEN-1: artikel % ontbreekt', r.slug;
    end if;
    if position(r.new_text in c) > 0 then
      continue; -- al bijgewerkt (tweede run)
    end if;
    n := (length(c) - length(replace(c, r.anchor, ''))) / length(r.anchor);
    if n <> 1 then
      raise exception 'HORECA-INSTELLINGEN-1: anker % keer in % (verwacht 1): %', n, r.slug, left(r.anchor, 80);
    end if;
    update public.doc_articles
       set content = replace(content, r.anchor, r.new_text), updated_at = now()
     where doc_level = 'tenant' and slug = r.slug;
  end loop;
end $$;

update public.doc_articles set context_path = '/admin/settings', updated_at = now()
 where doc_level = 'tenant' and slug = 'bon-en-printers' and context_path = '/admin/pos';
update public.doc_articles set context_path = '/admin/personeel', updated_at = now()
 where doc_level = 'tenant' and slug = 'kassapersoneel-pincodes' and context_path = '/admin/pos';
update public.doc_articles set context_path = '/admin/settings', updated_at = now()
 where doc_level = 'tenant' and slug = 'kassa-toestel-koppelen' and context_path = '/admin/pos';
update public.doc_articles set context_path = '/admin/settings', updated_at = now()
 where doc_level = 'tenant' and slug = 'meldingen-per-toestel' and context_path = '/admin/pos';
update public.doc_articles set context_path = '/admin/settings', updated_at = now()
 where doc_level = 'tenant' and slug = 'qr-online-betalen' and context_path = '/admin/bestellen';
update public.doc_articles set context_path = '/admin/settings', updated_at = now()
 where doc_level = 'tenant' and slug = 'openingsuren-instellen' and context_path = '/admin/settings?section=company';
update public.doc_articles set context_path = '/admin/reservaties', updated_at = now()
 where doc_level = 'tenant' and slug = 'reservaties' and context_path = '/admin/bestellen';

-- Nieuw artikel: Mijn zaak (horeca-only).
insert into public.doc_articles (category_id, doc_level, title, slug, content, excerpt, tags, context_path, sort_order, is_published)
values ('a0000001-0000-0000-0000-000000000006', 'tenant', 'Mijn zaak: al je instellingen op één plek', 'mijn-zaak-instellingen',
  '<p>Heb je enkel het horecapakket (zonder webshop- of eventspakket), dan heet <strong>Instellingen</strong> in je menu <strong>Mijn zaak</strong>. Alles wat je zaak instelt, staat daar op één plek per onderwerp.</p>
<h2>Je zaak inrichten</h2>
<p>Bovenaan staat voor de zaakvoerder de checklist <em>Je zaak inrichten: X van Y klaar</em>. Elke stap toont of hij klaar is, met een knop die je meteen naar de juiste plek brengt: je gegevens (naam, adres, btw-nummer), openingsuren, logo, een kassa met een gekoppeld toestel, kassapersoneel met een pincode, je zaalplan met tafels, minstens één post en of je website live staat. Laat je gasten via de QR-code online betalen of online bestellen, dan komt er een stap bij om online betalen (Stripe) te koppelen. Een printer is optioneel en telt niet mee.</p>
<h2>Zes groepen met tabs</h2>
<ul>
<li><strong>Je zaak</strong>: gegevens, openingsuren &amp; sluitingsdagen, logo &amp; kleuren en een link naar je website. Een eigen domeinnaam komt binnenkort.</li>
<li><strong>Je gasten</strong>: QR aan tafel, afhalen &amp; leveren, reserveren (paars vanaf, te laat na, online reserveren) en berichten aan gasten.</li>
<li><strong>Betalen</strong>: betaalwijzen aan de kassa, online betalen (Stripe), fooi en de betaalterminal. Op de tab <strong>Fooi</strong> zet je de fooi aan de kassa aan of uit en zie je of gasten fooi kunnen geven bij online afrekenen; dat laatste wijzig je bij QR aan tafel.</li>
<li><strong>Zaal &amp; keuken</strong>: je zaalplan, posten &amp; gangen, printers &amp; bon en de keukenschermen.</li>
<li><strong>Kassa''s &amp; toestellen</strong>: je kassa''s en gekoppelde toestellen, de vergrendeltijd van de kassa en de meldingen per toestel.</li>
<li><strong>Geld &amp; boekhouding</strong>: btw, facturen &amp; Peppol, je boekhouding (Odoo) en je SellQo-plan.</li>
</ul>
<p>Onder <strong>Jij</strong> staan je eigen profiel, je meldingen en je onderbalk op de gsm. Elke tab heeft een eigen link, die je kan bewaren of doorsturen.</p>
<p><strong>Wie ziet wat?</strong> De checklist en de groepen Je gasten, Betalen, Zaal &amp; keuken en Kassa''s &amp; toestellen zijn enkel voor de zaakvoerder (beheerder). Een medewerker ziet in Mijn zaak wat hij mag openen, zoals de groep Jij, met de regel <em>De instellingen van je zaak beheert de zaakvoerder.</em> De zoekbalk volgt dezelfde regel.</p>
<h2>Zoeken</h2>
<p>Weet je niet waar iets staat? Tik het in de zoekbalk bovenaan Mijn zaak, bijvoorbeeld <em>fooi</em>, <em>printer</em>, <em>pin</em>, <em>terras</em> of <em>vakantie</em>. Zoeken kan ook op elke pagina met het vergrootglas bovenaan of met ⌘K (Mac) of Ctrl+K. Je ziet enkel wat je met jouw rol mag openen.</p>
<h2>Personeel en Reservaties</h2>
<p>Je medewerkers met hun pincode, hun uren en wie de zaak mag beheren, staan samen onder <strong>Personeel</strong> in het menu. Je reservaties per dag staan onder <strong>Reservaties</strong>. Oude links (bv. naar Kassa › Personeel of Kaart › Instellen › QR-menu) brengen je vanzelf naar de nieuwe plek.</p>
<p>Heb je ook een webshop- of eventspakket, dan blijft alles zoals het was: je instellingen staan onder <strong>Instellingen</strong>, je kassa-instellingen onder <strong>Kassa (POS)</strong> en de QR- en afhaalinstellingen onder <strong>Kaart › Instellen</strong>.</p>',
  'Met enkel het horecapakket staan al je instellingen in Mijn zaak: een checklist om je zaak in te richten, zes groepen met tabs en een zoekbalk.', array['horeca', 'instellingen', 'mijn zaak', 'zoeken', 'checklist'], '/admin/settings', 0, true)
on conflict (doc_level, slug) do update
  set title = excluded.title, content = excluded.content, excerpt = excluded.excerpt, tags = excluded.tags,
      context_path = excluded.context_path, updated_at = now()
  where public.doc_articles.content is distinct from excluded.content
     or public.doc_articles.title is distinct from excluded.title
     or public.doc_articles.excerpt is distinct from excluded.excerpt;
