-- KASSA-MOBIEL-1 — helpartikel "Een kassatoestel koppelen en ontkoppelen" bijwerken: één-tik-koppelen vanuit een
-- beheer-sessie, kassa en beheer naast elkaar op hetzelfde toestel, terugknop, en de verdwenen melding
-- "Dit is geen kassatoestel". Live inhoud nagetrokken op 2-11-2026 (md5 13bc2c691fdda54c8e13f007d5d1bf2b).
-- PAS DRAAIEN NA de publish van sellqo.app met KASSA-MOBIEL-1 (anders beschrijft het artikel wat nog niet live is).
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE met de volledige inhoud; twee keer draaien = zelfde resultaat.
-- Snapshot vooraf: snapshots.sellqo_20261102_doc_kassa_mobiel_1 (de rij zoals ze was).
-- Handmatig terugdraaien:
--   update public.doc_articles d set title = s.title, excerpt = s.excerpt, tags = s.tags, content = s.content, updated_at = now()
--     from snapshots.sellqo_20261102_doc_kassa_mobiel_1 s where d.id = s.id;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261102_doc_kassa_mobiel_1 as
  select id, doc_level, slug, title, excerpt, tags, content, md5(content) as md5, now() as taken_at
    from public.doc_articles where doc_level = 'tenant' and slug = 'kassa-toestel-koppelen';
revoke all on snapshots.sellqo_20261102_doc_kassa_mobiel_1 from anon, authenticated;

insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, context_path, sort_order, is_published, tags, content)
values (
  'a0000001-0000-0000-0000-000000000006', 'tenant',
  'Een kassatoestel koppelen en ontkoppelen',
  'kassa-toestel-koppelen',
  'Elk toestel met SellQo Kassa krijgt een eigen koppeling met enkel kassarechten. Ben je op het toestel in beheer aangemeld, dan koppel je het met één tik; anders met een code of QR uit Kassa (POS) › Kassa''s.',
  '/admin/pos', 4, true, array['kassa', 'toestel', 'koppelen', 'beveiliging'],
  $doc$<p>SellQo Kassa draait op een <strong>gekoppeld toestel</strong>: een tablet, gsm of computer met een eigen aanmelding die enkel kassarechten heeft. Je eigen SellQo-account gebruik je nooit op de kassa. Zo kan wie het toestel in handen krijgt geen prijzen, klanten, facturen of instellingen van je zaak bekijken of wijzigen: enkel wat de kassa nodig heeft.</p>

<h2>Kassa en beheer op hetzelfde toestel</h2>
<p>De kassa en het beheer hebben elk een eigen aanmelding. Je kan dus op dezelfde gsm, tablet of in dezelfde browser in beheer aangemeld blijven én een gekoppelde kassa gebruiken. Ga je vanuit de kassa naar beheer (⋯-menu › <strong>Naar SellQo-beheer</strong>, enkel voor eigenaar of verantwoordelijke), dan blijft de kassa gekoppeld. Meld je je in beheer af, dan blijft de kassa gekoppeld; ontkoppel je de kassa, dan blijf je in beheer aangemeld.</p>

<h2>Een toestel koppelen met één tik</h2>
<p>Ben je op het toestel zelf als zaakvoerder in beheer aangemeld, dan hoef je geen code over te tikken:</p>
<ol>
  <li>Open <code>/kassa</code> op het toestel (bijvoorbeeld via <strong>Kassa</strong> in het keukenscherm of in het menu).</li>
  <li>Bovenaan staat <strong>Dit toestel nu koppelen</strong>. Kies de zaak (als je er meer hebt) en de kassa.</li>
  <li>Tik op <strong>Dit toestel nu koppelen</strong>. Het toestel is meteen gekoppeld; je medewerkers kiezen daarna hun naam en tikken hun pincode.</li>
</ol>

<h2>Een toestel koppelen met een code of QR</h2>
<ol>
  <li>Ga in SellQo naar <strong>Kassa (POS) › Kassa's</strong>. Heb je nog geen kassa, maak er dan eerst een aan met <strong>Nieuwe Terminal</strong>.</li>
  <li>Klik bij de juiste kassa op <strong>Toestel koppelen</strong>. Je ziet een code van 6 cijfers en een QR-code. Ze zijn 10 minuten geldig en werken één keer.</li>
  <li>Open op het toestel <strong>SellQo Kassa</strong> (de app, of <code>/kassa</code> in de browser) en tik de 6 cijfers in, of tik op <strong>QR-code scannen</strong>. Je kan de QR-code ook met de gewone camera van het toestel scannen: dan opent de kassa en koppelt ze meteen.</li>
  <li>In beheer zie je <strong>Gekoppeld</strong>. Op het toestel kiezen je medewerkers daarna hun naam en tikken ze hun pincode, zoals altijd.</li>
</ol>
<p>Bovenaan het koppelscherm staat <strong>Terug naar beheer</strong> (niet in de aparte SellQo Kassa-app, daar is geen beheer). Enkel de zaakvoerder kan toestellen koppelen en ontkoppelen. Na vijf foute codes vanaf hetzelfde netwerk moet je een kwartier wachten. Wordt er op grote schaal naar codes geraden, dan vervallen de open 6-cijfercodes; de QR-code blijft dan werken.</p>

<h2>Gekoppelde toestellen</h2>
<p>Onder elke kassa staan de gekoppelde toestellen met hun naam, wanneer ze laatst gezien werden, of er nog iets op het toestel wacht en de versie van SellQo Kassa. Een toestel dat nog met een gewone SellQo-account draait (van vóór de koppeling), staat er als <strong>Oude aanmelding (niet gekoppeld)</strong>. Koppel dat toestel opnieuw. Toestellen die al gekoppeld waren, blijven na deze update gewoon gekoppeld.</p>

<h2>Ontkoppelen</h2>
<ul>
  <li>Klik bij het toestel op <strong>Ontkoppelen</strong>. Vanaf dat moment kan het toestel niets meer op de kassa, ook niet als het nog openstaat. Openstaande rekeningen blijven bewaard.</li>
  <li>Op de kassa zelf kan een eigenaar of verantwoordelijke in het ⋯-menu kiezen voor <strong>Ontkoppel dit toestel</strong>. Wie op hetzelfde toestel in beheer aangemeld is, blijft dat.</li>
  <li>Een ontkoppeld toestel toont <strong>Dit toestel is ontkoppeld</strong>. Tik op <strong>Opnieuw koppelen</strong> en koppel het met één tik of met een nieuwe code. Een toestel dat nog gekoppeld is, kan je niet opnieuw koppelen: ontkoppel het eerst in beheer.</li>
</ul>

<h2>Meldingen op een gekoppelde kassa</h2>
<p>Zet je op de kassa via het ⋯-menu › <strong>Meldingen en geluid</strong> de meldingen aan, dan hoort die inschrijving bij het gekoppelde toestel, niet bij jouw account. Stond het toestel voor meldingen nog op een andere account, dan zet SellQo de inschrijving over. Lukt het toch niet, dan zie je in de melding waarom.</p>$doc$
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, context_path = excluded.context_path, sort_order = excluded.sort_order,
  tags = excluded.tags, content = excluded.content, updated_at = now();
