-- REKENING-ONLINE-1 — helpartikels.
--   1. Nieuw: "Gasten betalen online aan tafel" (qr-online-betalen, /admin/pos), ON CONFLICT DO NOTHING.
--   2. "Afrekenen op SellQo Kassa" (kassa-afrekenen): alinea over online betaald door gasten;
--      md5-guard 1454780ba0aa265f8535a75aa109916c.
--   3. "Bestellingen via de QR op de tafelrekening" (qr-tafelrekening): afrekenen kan ook online;
--      md5-guard 758c6098cff6a792cc6ef9b54c4eb759.
-- PAS DRAAIEN NA de migratie 20261028140000 en de publish van de admin. Idempotent (md5-guards).
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content
--     from snapshots.sellqo_20261028_doc_articles_ro1 s where d.id = s.id;
--   delete from public.doc_articles where doc_level = 'tenant' and slug = 'qr-online-betalen';

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261028_doc_articles_ro1 as
  select * from public.doc_articles where doc_level = 'tenant' and slug in ('kassa-afrekenen', 'qr-tafelrekening');
revoke all on snapshots.sellqo_20261028_doc_articles_ro1 from anon, authenticated;

insert into public.doc_articles (doc_level, category_id, context_path, slug, title, excerpt, content, sort_order, is_published)
values ('tenant', 'a0000001-0000-0000-0000-000000000006', '/admin/pos', 'qr-online-betalen',
  'Gasten betalen online aan tafel',
  'Via de QR-code op tafel betalen gasten zelf de rekening: alles, hun eigen items of gelijk gedeeld, met fooi als je wil.',
  $c$
<p>Werk je met de QR-code <strong>op de tafelrekening</strong>, dan kunnen gasten de rekening ook zelf online betalen. Dat zet je aan onder <strong>Kassa › Betalen</strong>, bij <em>Afrekenen via de QR aan tafel</em>.</p>

<h2>Wat je nodig hebt</h2>
<ul>
  <li>Een gekoppeld Stripe-account (<strong>Betalingen</strong>). Het geld komt rechtstreeks op je Stripe-account.</li>
  <li>Een zaalplan met een eigen QR-code per tafel (<strong>Bestellen › Zaalplan</strong>). Met een vrij tafelnummer kan je rekening niet online bekeken worden.</li>
  <li>Geen geregistreerde kassa (GKS). Met een geregistreerde kassa sluit enkel de kassa een rekening af; online betalen aan tafel staat dan uit.</li>
</ul>

<h2>Wat de gast ziet</h2>
<ol>
  <li>In het QR-menu tikt hij op <strong>Je rekening</strong>. Hij ziet wat er al verstuurd is naar keuken en bar, met de bedragen.</li>
  <li>Hij kiest <strong>Alles</strong>, <strong>Mijn items</strong> (per gerecht of drankje hoeveel hij neemt) of <strong>Gelijk delen</strong> (met hoeveel jullie zijn, en voor hoeveel personen hij betaalt). Splitsen kan je uitzetten.</li>
  <li>Staat fooi aan, dan kiest hij 5, 10 of 15 % of een eigen bedrag.</li>
  <li>Hij betaalt via Stripe (Bancontact, kaart of wallet) en ziet daarna <em>Betaald</em>.</li>
</ol>
<p>Wie aan het betalen is, houdt zijn items of zijn deel 10 minuten vast: een tweede gast kan die dan niet ook kiezen. Breekt hij af, dan komt alles meteen weer vrij.</p>

<h2>Wat er op de kassa gebeurt</h2>
<ul>
  <li><strong>Alles</strong> betaald: de rekening sluit vanzelf. Je ziet de betaling bij de verkopen, op de kassa <em>Online (QR)</em>.</li>
  <li><strong>Mijn items</strong>: die items gaan naar een apart deel van de rekening dat meteen betaald is. De rest blijft op de tafel.</li>
  <li><strong>Gelijk delen</strong>: het bedrag staat als <em>al online betaald</em> op de rekening. Is alles betaald, dan sluit de tafel vanzelf. Anders reken je de rest af aan de kassa; het afrekenvenster toont wat al online betaald is en vraagt enkel de rest.</li>
  <li>Betaalt een gast net online, dan kan je die rekening even niet afrekenen of splitsen. De kassa zegt dat; probeer het na een paar minuten opnieuw.</li>
</ul>

<h2>Als de rekening intussen veranderde</h2>
<p>Komt een online betaling binnen terwijl de rekening al aan de kassa betaald werd, of klopt ze niet meer met wat de gast koos, dan stort SellQo het bedrag automatisch terug (inclusief een eventuele platformkost). Je krijgt een melding, en de gast ziet dat zijn betaling teruggestort werd. Lukt terugstorten niet, dan krijg je een melding met hoge prioriteit: stort dan terug via je Stripe-dashboard.</p>

<h2>In je rapporten</h2>
<ul>
  <li>In het X- en Z-rapport staat <em>Online (QR)</em> als aparte betaalwijze, en de fooi die online gegeven werd als fooi <em>Online (QR)</em>.</li>
  <li>Online betalingen komen nooit in je kassalade.</li>
  <li>Zit je boven de limiet van je pakket, dan geldt dezelfde platformkost als bij online bestellingen.</li>
</ul>
$c$, 35, true)
on conflict (doc_level, slug) do nothing;

update public.doc_articles
   set content = replace(content,
     $o$<h2>Fooi</h2>$o$,
     $n$<h2>Al online betaald door gasten</h2>
<p>Betaalden gasten via de QR-code al een deel van de rekening (gelijk delen), dan toont het afrekenvenster hoeveel al online betaald is en vraagt het enkel de rest. Dat online deel staat in je rapporten als <em>Online (QR)</em>. Betaalt een gast nét online, dan wacht de kassa even. Meer in <strong>Gasten betalen online aan tafel</strong>.</p>

<h2>Fooi</h2>$n$),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'kassa-afrekenen'
   and md5(content) = '1454780ba0aa265f8535a75aa109916c';

update public.doc_articles
   set content = replace(content,
     $o$<p>De tafel rekent af zoals altijd op de kassa: contant, overschrijving met QR-code, of wat je zaak aanbiedt. Hoe dat werkt, lees je in <strong>Afrekenen op SellQo Kassa</strong>.</p>$o$,
     $n$<p>De tafel rekent af zoals altijd op de kassa: contant, overschrijving met QR-code, of wat je zaak aanbiedt. Hoe dat werkt, lees je in <strong>Afrekenen op SellQo Kassa</strong>.</p>
<p>Gasten kunnen de rekening ook zelf online betalen, helemaal of gesplitst. Dat zet je aan onder <strong>Kassa › Betalen</strong>; lees <strong>Gasten betalen online aan tafel</strong>.</p>$n$),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'qr-tafelrekening'
   and md5(content) = '758c6098cff6a792cc6ef9b54c4eb759';
