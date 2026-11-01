-- HORECA-ZIJBALK-1 — helpartikels volgen de nieuwe horeca-zijbalk.
--   1. Padteksten: "Bestellen › …" heet in het menu nu "Kaart" (de pagina opent op de Kaart; wat je
--      instelt staat onder "Instellen"); het zaalplan staat onder "Zaal › Zaalplan bewerken".
--   2. "Horeca-zaalplan: tafels en een QR-code per tafel": context naar /admin/zaal.
--   3. "Je horeca-werkplek: wat staat waar": nieuwe zijbalk, gsm-onderbalk en de GKS-uitleg.
--   4. Nieuw: "Zaal: live zien welke tafels open staan" (tenant, /admin/zaal).
-- PAS DRAAIEN NA de publish van de admin (anders beschrijven de artikels een menu dat nog niet bestaat).
--
-- Idempotent: replace() vindt na de eerste run niets meer (de nieuwe tekst bevat de oude niet);
-- ON CONFLICT (doc_level, slug) voor 3 en 4; de snapshot wordt maar één keer gemaakt.
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content, context_path = s.context_path, excerpt = s.excerpt
--     from snapshots.sellqo_20261101_doc_articles_horeca_zijbalk1 s where d.id = s.id;
--   delete from public.doc_articles where doc_level = 'tenant' and slug = 'zaal-live-overzicht';

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261101_doc_articles_horeca_zijbalk1 as
  select * from public.doc_articles
   where doc_level = 'tenant'
     and slug in ('bon-en-printers', 'horeca-kaart', 'kassa-product-aanpassen', 'kassa-tafels-rekeningen',
                  'keukenscherm-en-tafelbestelling', 'qr-online-betalen', 'qr-tafelrekening', 'reservaties',
                  'zaalplan-en-qr-per-tafel', 'horeca-werkplek');
revoke all on snapshots.sellqo_20261101_doc_articles_horeca_zijbalk1 from anon, authenticated;

-- 1 + 2. Padteksten (live gemeten op 1-11-2026 met regexp_matches op "Bestellen ›|→").
update public.doc_articles
   set content =
         replace(replace(replace(replace(replace(replace(replace(replace(replace(content,
           'Bestellen › Kaart', 'Kaart'),
           'Bestellen opent meteen op deze tab', 'De pagina opent meteen op deze tab'),
           'Bestellen › Posten', 'Kaart › Instellen › Posten'),
           'Bestellen › Zaalplan', 'Zaal › Zaalplan bewerken'),
           'Bestellen → Zaalplan', 'Zaal › Zaalplan bewerken'),
           'Bestellen → QR-menu in de zaak', 'Kaart › Instellen › QR-menu in de zaak'),
           'Bestellen › QR-menu', 'Kaart › Instellen › QR-menu'),
           'Bestellen › Reservaties', 'Kaart › Reservaties'),
           'Je ziet dit enkel als de horeca-module aanstaat voor je zaak.',
           'Op de tab <strong>Live</strong> ernaast zie je welke tafels nu open staan. Je ziet dit enkel als de horeca-module aanstaat voor je zaak.'),
       context_path = case when slug = 'zaalplan-en-qr-per-tafel' then '/admin/zaal' else context_path end,
       updated_at = now()
 where doc_level = 'tenant'
   and slug in ('bon-en-printers', 'horeca-kaart', 'kassa-product-aanpassen', 'kassa-tafels-rekeningen',
                'keukenscherm-en-tafelbestelling', 'qr-online-betalen', 'qr-tafelrekening', 'reservaties',
                'zaalplan-en-qr-per-tafel')
   and (content ~ 'Bestellen\s*(›|→)' or (slug = 'zaalplan-en-qr-per-tafel' and context_path <> '/admin/zaal'));

-- 3. De werkplek-uitleg.
insert into public.doc_articles (doc_level, slug, title, excerpt, content, context_path, category_id, sort_order, is_published)
values (
  'tenant',
  'horeca-werkplek',
  'Je horeca-werkplek: wat staat waar',
  'Met een horecapakket zonder webshop zie je enkel wat een zaak nodig heeft. Zo vind je alles terug.',
  $c$<h2>Je horeca-werkplek</h2>
<p>Heb je een horecapakket zonder webshop- of eventspakket, dan toont SellQo in het menu en in de instellingen enkel wat een zaak nodig heeft, in deze volgorde.</p>
<h3>Dagelijks</h3>
<ul>
<li><strong>Vandaag</strong>: je dag in één oogopslag, met wat er in de keuken klaarstaat.</li>
<li><strong>Kassa-app</strong>: opent SellQo Kassa, met tafels, rekeningen en de toog.</li>
<li><strong>Zaal</strong>: live zien welke tafels open staan, voor hoeveel en sinds wanneer. Je zaalplan teken je op de tab <strong>Zaalplan bewerken</strong>.</li>
<li><strong>Keuken</strong>: het keukenscherm. Kies per scherm welke post het toont.</li>
<li><strong>Bestellingen</strong>: alle bestellingen, van de kassa, de QR-code aan tafel en online.</li>
</ul>
<h3>Beheer</h3>
<ul>
<li><strong>Kaart</strong>: al je producten en categorieën, met prijs, kostprijs en foodcost. Ernaast staan het <strong>Overzicht</strong> en je <strong>Reservaties</strong>. Wat je eenmalig instelt, staat onder <strong>Instellen</strong>: QR-menu, posten (bar, keuken), extra's, allergenen en afhalen en leveren.</li>
<li><strong>Betalingen</strong>, <strong>Rapporten</strong> en <strong>Inkoop</strong> (leveranciers en hun facturen).</li>
</ul>
<h3>Systeem</h3>
<ul>
<li><strong>Instellingen</strong>: onder <strong>Instellingen › Horeca</strong> zie je al je horeca-instellingen met hun huidige stand, met een link naar de plek waar je ze aanpast. Je kassa's, personeel en pincodes, betalen en printers vind je daar ook. Onderdelen die niet in je menu staan (zoals je SellQo-plan) vind je onder <strong>Instellingen › Meer onderdelen</strong>.</li>
<li><strong>Help</strong>.</li>
</ul>
<h3>Op je gsm</h3>
<p>Onderaan staan de vier plekken waar je de hele dag tussen wisselt: <strong>Vandaag</strong>, <strong>Kassa</strong> (opent SellQo Kassa), <strong>Keuken</strong> en <strong>Kaart</strong> (iets op "op" zetten of terugzetten). Al de rest vind je in het menu bovenaan. Wil je andere snelkoppelingen, zoals <strong>Zaal</strong>? Die kies je zelf in <strong>Instellingen › Mijn onderbalk</strong>.</p>
<h3>Geregistreerd kassasysteem (GKS)</h3>
<p>SellQo Kassa is (nog) niet gecertificeerd als geregistreerd kassasysteem (GKS 2.0). Verkoop je meer dan € 25.000 per jaar (excl. btw) aan maaltijden die ter plaatse gegeten worden, of staat er bij je huidige kassa een fiscale datamodule (FDM, de "zwarte doos"), dan ben je GKS-plichtig. Gebruik SellQo dan niet als je registrerende kassa zolang SellQo Kassa niet gecertificeerd is. Twijfel je of dit voor jouw zaak geldt? Vraag het na bij je boekhouder.</p>
<h3>Wat je niet ziet</h3>
<p>Klanten, kortingen, e-mailmarketing, media, vertalingen, retouren en reviews horen bij een webshop. Neem je er een webshop- of eventspakket bij, dan verschijnen ze vanzelf; je horeca-onderdelen staan dan samen in de groep <strong>Horeca</strong>.</p>$c$,
  '/admin/bestellen',
  'a0000001-0000-0000-0000-000000000006',
  1,
  true
)
on conflict (doc_level, slug) do update
  set content = excluded.content, excerpt = excluded.excerpt, updated_at = now();

-- 4. Nieuw: het live zaaloverzicht.
insert into public.doc_articles (doc_level, slug, title, excerpt, content, context_path, category_id, sort_order, tags, is_published)
values (
  'tenant',
  'zaal-live-overzicht',
  'Zaal: live zien welke tafels open staan',
  'Op Zaal zie je in het beheer welke tafels bezet zijn, voor hoeveel, sinds wanneer en wie de rekening vroeg.',
  $c$<h2>Wat zie je op Zaal?</h2>
<p>Onder <strong>Zaal</strong> zie je op de tab <strong>Live</strong> wat er nu open staat in je zaak, zonder dat je aan de kassa staat. Handig vanop kantoor of je gsm.</p>
<ul>
<li>Bovenaan: hoeveel tafels bezet zijn, hoeveel rekeningen open staan en voor welk bedrag in totaal.</li>
<li>Je zaalplan, in dezelfde kleuren als op SellQo Kassa: groen is bezet, blauw is rekening gevraagd. Op elke bezette tafel staan het bedrag en hoeveel minuten ze open is.</li>
<li>Daaronder de lijst van alle open rekeningen, ook die op naam en aan de toog: hoe lang ze open staan, het aantal personen, de stand (bezet, rekening gevraagd, wordt afgerekend) en het bedrag. De langst openstaande staat bovenaan.</li>
</ul>
<h2>Hoe actueel is het?</h2>
<p>Het overzicht ververst elke 10 seconden; het tijdstip van de laatste verversing staat erbij. SellQo Kassa zelf toont wijzigingen meteen. Het bedrag is hetzelfde als op de kassa: alles wat op de rekening staat, ook wat nog niet naar de keuken verstuurd is.</p>
<h2>Iets aanpassen</h2>
<p>Zaal is alleen-lezen: rekeningen openen, bijboeken en afrekenen doe je op SellQo Kassa. Je zaalplan (ruimtes, tafels, QR-stickers) teken en wijzig je op de tab <strong>Zaalplan bewerken</strong>. Heb je nog geen zaalplan, dan zie je enkel de lijst.</p>$c$,
  '/admin/zaal',
  'a0000001-0000-0000-0000-000000000006',
  7,
  array['horeca', 'zaal', 'zaalplan', 'tafels', 'live'],
  true
)
on conflict (doc_level, slug) do update
  set title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
      context_path = excluded.context_path, tags = excluded.tags, updated_at = now();
