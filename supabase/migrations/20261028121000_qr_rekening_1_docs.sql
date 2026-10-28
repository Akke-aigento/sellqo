-- QR-REKENING-1 — helpartikels.
--   1. Nieuw: "Bestellingen via de QR op de tafelrekening" (qr-tafelrekening, /kassa).
--      ON CONFLICT DO NOTHING: een tweede run of een latere handmatige wijziging blijft staan.
--   2. "Keukenscherm en bestellen aan tafel": alinea over de instelling, replace() met md5-guard
--      op de live tekst van 28-10-2026 (89e8efc7f09ba20e55a8766a75b142eb).
--   3. "Tafels en rekeningen op SellQo Kassa": oranje tegel in het tafeloverzicht, replace() met
--      md5-guard (5dd646ee1be5233390e6b4f82922c89c).
-- PAS DRAAIEN NA de migratie 20261028120000 en de publish van de admin.
-- Idempotent: na de eerste run kloppen de md5-guards niet meer → 0 rijen.
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content
--     from snapshots.sellqo_20261028_doc_articles_qrrek1 s where d.id = s.id;
--   delete from public.doc_articles where doc_level = 'tenant' and slug = 'qr-tafelrekening';

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261028_doc_articles_qrrek1 as
  select * from public.doc_articles where doc_level = 'tenant' and slug in ('keukenscherm-en-tafelbestelling', 'kassa-tafels-rekeningen');
revoke all on snapshots.sellqo_20261028_doc_articles_qrrek1 from anon, authenticated;

insert into public.doc_articles (doc_level, category_id, context_path, slug, title, excerpt, content, sort_order, is_published)
values ('tenant', 'a0000001-0000-0000-0000-000000000006', '/kassa', 'qr-tafelrekening',
  'Bestellingen via de QR op de tafelrekening',
  'Gasten bestellen via de QR-code op tafel, jij bevestigt op de kassa en het komt op de rekening van die tafel. Betalen gebeurt op het einde.',
  $c$
<p>Bestellen gasten via de QR-code op hun tafel, dan kan je kiezen hoe dat verloopt. Dat stel je in onder <strong>Bestellen › QR-menu</strong>, bij <em>Waar komt een bestelling aan tafel terecht?</em></p>
<ul>
  <li><strong>Op de tafelrekening</strong> (aanbevolen): de gast betaalt niet meteen. Zijn bestelling komt binnen op de kassa, jij bevestigt, en ze staat op de rekening van die tafel. Op het einde betaalt de tafel alles samen.</li>
  <li><strong>Elke bestelling apart afrekenen</strong>: elke bestelling is een aparte bestelling die de gast meteen betaalt, online of aan de toog.</li>
</ul>

<h2>Wat de gast ziet</h2>
<ol>
  <li>Hij kiest op het menu wat hij wil en tikt op <strong>Bestelling doorgeven</strong>. Een naam en een opmerking voor de keuken zijn optioneel.</li>
  <li>Hij ziet <em>Doorgegeven, de bediening bevestigt zo meteen</em>. Zodra jij bevestigt, wordt dat <em>Bevestigd en op je tafelrekening gezet</em>. Weiger je, dan ziet hij de reden en staat er niets op zijn rekening.</li>
  <li>Hij kan daarna gewoon nog iets bestellen. Elke bestelling komt apart binnen.</li>
</ol>
<p>Producten die op zijn of die je niet aan tafel verkoopt, kan hij niet doorgeven; hij krijgt meteen een melding.</p>

<h2>Bevestigen op de kassa</h2>
<ul>
  <li>Wachten er bestellingen, dan staat bovenaan de kassa een oranje knop <strong>QR</strong> met het aantal. De tafel kleurt oranje in het tafeloverzicht.</li>
  <li>Tik op de knop: je ziet de bestellingen per tafel, de oudste eerst. Met <strong>Alles op de rekening</strong> bevestig je alles van een tafel in één tik, of je doet ze één voor één.</li>
  <li>Een bevestigde bestelling komt op de lopende rekening van die tafel (of de kassa opent er een) en gaat meteen als ronde naar keuken en bar.</li>
  <li>Met <strong>Weigeren</strong> kies je een reden (iets is op, keuken is dicht, vraag het aan de bediening, of een eigen reden). De gast ziet die reden.</li>
  <li>Werk je met meerdere toestellen, dan mag iedereen die op de kassa ingelogd is bevestigen. Tikken twee mensen tegelijk, dan komt de bestelling er toch maar één keer op.</li>
</ul>

<h2>Automatisch bevestigen</h2>
<p>Onder dezelfde instelling kan je <strong>Automatisch bevestigen</strong> aanzetten. Een kassa die openstaat zet nieuwe bestellingen dan meteen op de rekening, zonder dat iemand tikt. Niemand kijkt ze dan eerst na: is iets op, dan moet je dat achteraf op de rekening rechtzetten. Zet het enkel aan als je je voorraad goed opvolgt. Er moet wel een kassa openstaan; anders blijven de bestellingen wachten tot er één opengaat. Automatisch bevestigen werkt enkel voor tafels uit je zaalplan (met een eigen QR-code per tafel); werk je zonder zaalplan, dan bevestig je zelf.</p>

<h2>Afrekenen</h2>
<p>De tafel rekent af zoals altijd op de kassa: contant, overschrijving met QR-code, of wat je zaak aanbiedt. Hoe dat werkt, lees je in <strong>Afrekenen op SellQo Kassa</strong>.</p>
$c$, 34, true)
on conflict (doc_level, slug) do nothing;

update public.doc_articles
   set content = replace(content,
     $o$  <li>Gerechten die je enkel aan tafel verkoopt, tonen online: <em>Dit kan je niet online bestellen.</em></li>
</ul>$o$,
     $n$  <li>Gerechten die je enkel aan tafel verkoopt, tonen online: <em>Dit kan je niet online bestellen.</em></li>
</ul>
<p>Of de gast meteen betaalt of zijn bestelling op de tafelrekening komt, kies je onder <strong>Bestellen › QR-menu</strong>. Hoe bevestigen op de kassa werkt, lees je in <strong>Bestellingen via de QR op de tafelrekening</strong>.</p>$n$),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'keukenscherm-en-tafelbestelling'
   and md5(content) = '89e8efc7f09ba20e55a8766a75b142eb';

update public.doc_articles
   set content = replace(content,
     $o$<strong>Blauw</strong>: de rekening is gevraagd.</li>$o$,
     $n$<strong>Blauw</strong>: de rekening is gevraagd. <strong>Oranje</strong>: er wacht een bestelling via de QR-code op tafel (zie <strong>Bestellingen via de QR op de tafelrekening</strong>).</li>$n$),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'kassa-tafels-rekeningen'
   and md5(content) = '5dd646ee1be5233390e6b4f82922c89c';
