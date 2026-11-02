-- KASSA-ACCOUNT-1b — helpartikels: een kassatoestel koppelen en ontkoppelen (nieuw), en de zin over "aanmelden met je
-- SellQo-account" in kassapersoneel-pincodes vervangen. Anker nagetrokken op de live inhoud (query_database, 2-11-2026).
-- PAS DRAAIEN NA 20261102100000_kassa_account_1.sql, de edge functions en de publish van de kassa/beheer.
-- Idempotent: nieuw artikel via ON CONFLICT (doc_level, slug); de vervanging slaat over als ze al gebeurd is.
-- Review 1 (12): de toestelaccounts gebruiken adressen kassa-<uuid>@toestel.sellqo.app. Dat domein mag NOOIT mail
-- ontvangen: geen MX-record en geen catch-all/alias in Migadu of elders. Wie er mail op kan ontvangen, kan via
-- "wachtwoord vergeten" een toestelaccount overnemen. Natrekken bij elke DNS-/mailwijziging op sellqo.app.
-- Handmatig terugdraaien: delete from public.doc_articles where doc_level = 'tenant' and slug = 'kassa-toestel-koppelen';
--   en in kassapersoneel-pincodes de nieuwe zin (b) weer vervangen door het anker (a).
insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, context_path, sort_order, is_published, tags, content)
values (
  'a0000001-0000-0000-0000-000000000006', 'tenant',
  'Een kassatoestel koppelen en ontkoppelen',
  'kassa-toestel-koppelen',
  'Elk toestel met SellQo Kassa krijgt een eigen koppeling met enkel kassarechten. Je koppelt het met een code of QR uit Kassa (POS) › Kassa''s en ontkoppelt het daar ook.',
  '/admin/pos', 4, true, array['kassa', 'toestel', 'koppelen', 'beveiliging'],
  $doc$<p>SellQo Kassa draait op een <strong>gekoppeld toestel</strong>: een tablet, gsm of computer met een eigen aanmelding die enkel kassarechten heeft. Je meldt je op de kassa dus nooit meer aan met je eigen SellQo-account. Zo kan wie het toestel in handen krijgt geen prijzen, klanten, facturen of instellingen van je zaak bekijken of wijzigen: enkel wat de kassa nodig heeft.</p>

<h2>Een toestel koppelen</h2>
<ol>
  <li>Ga in SellQo naar <strong>Kassa (POS) › Kassa's</strong>. Heb je nog geen kassa, maak er dan eerst een aan met <strong>Nieuwe Terminal</strong>.</li>
  <li>Klik bij de juiste kassa op <strong>Toestel koppelen</strong>. Je ziet een code van 6 cijfers en een QR-code. Ze zijn 10 minuten geldig en werken één keer.</li>
  <li>Open op het toestel <strong>SellQo Kassa</strong> (de app, of <code>/kassa</code> in de browser) en tik de 6 cijfers in, of tik op <strong>QR-code scannen</strong>. Je kan de QR-code ook met de gewone camera van het toestel scannen: dan opent de kassa en koppelt ze meteen.</li>
  <li>In beheer zie je <strong>Gekoppeld</strong>. Op het toestel kiezen je medewerkers daarna hun naam en tikken ze hun pincode, zoals altijd.</li>
</ol>
<p>Enkel de zaakvoerder kan toestellen koppelen en ontkoppelen. Na vijf foute codes vanaf hetzelfde netwerk moet je een kwartier wachten. Wordt er op grote schaal naar codes geraden, dan vervallen de open 6-cijfercodes; de QR-code blijft dan werken.</p>

<h2>Gekoppelde toestellen</h2>
<p>Onder elke kassa staan de gekoppelde toestellen met hun naam, wanneer ze laatst gezien werden, of er nog iets op het toestel wacht en de versie van SellQo Kassa. Een toestel dat nog met een gewone SellQo-account draait (van vóór de koppeling), staat er als <strong>Oude aanmelding (niet gekoppeld)</strong>. Koppel dat toestel opnieuw met een code.</p>

<h2>Ontkoppelen</h2>
<ul>
  <li>Klik bij het toestel op <strong>Ontkoppelen</strong>. Vanaf dat moment kan het toestel niets meer op de kassa, ook niet als het nog openstaat. Openstaande rekeningen blijven bewaard.</li>
  <li>Op de kassa zelf kan een eigenaar of verantwoordelijke in het ⋯-menu kiezen voor <strong>Ontkoppel dit toestel</strong>.</li>
  <li>Een ontkoppeld toestel gebruik je opnieuw met een nieuwe koppelcode. Een toestel dat nog gekoppeld is, kan je niet opnieuw koppelen: ontkoppel het eerst hier.</li>
</ul>

<h2>Naar beheer vanaf de kassa</h2>
<p>Beheer open je op een ander toestel. In de browser deelt beheer de aanmelding met de kassa: meld je daar aan met je eigen account, dan wordt de kassa afgemeld en moet je ze opnieuw koppelen. Daarom toont de kassa in de browser enkel de tip <strong>Open beheer op een ander toestel</strong>. In de SellQo Kassa-app opent <strong>Naar SellQo-beheer</strong> de gewone browser van het toestel.</p>

<h2>Je eigen account op /kassa</h2>
<p>Open je <code>/kassa</code> terwijl je met je eigen SellQo-account aangemeld bent, dan toont de kassa <strong>Dit is geen kassatoestel</strong>, met een link naar Kassa (POS) › Kassa's en een knop om je af te melden en het toestel te koppelen.</p>$doc$
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, context_path = excluded.context_path, sort_order = excluded.sort_order,
  tags = excluded.tags, content = excluded.content, updated_at = now();

do $doc$
declare
  d text;
  a text := 'Meld het toestel één keer aan met je SellQo-account en kies welke kassa het is.';
  b text := 'Koppel het toestel één keer met een koppelcode of QR uit <strong>Kassa (POS) › Kassa''s</strong> (zie "Een kassatoestel koppelen en ontkoppelen"); je eigen SellQo-account gebruik je op de kassa niet.';
begin
  select content into d from public.doc_articles where doc_level = 'tenant' and slug = 'kassapersoneel-pincodes';
  if d is null then raise exception 'KASSA-ACCOUNT-1 docs: kassapersoneel-pincodes ontbreekt'; end if;
  if position(b in d) > 0 then raise notice 'KASSA-ACCOUNT-1 docs: al bijgewerkt'; return; end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then
    raise exception 'KASSA-ACCOUNT-1 docs: anker niet precies één keer gevonden';
  end if;
  update public.doc_articles set content = replace(d, a, b), updated_at = now()
   where doc_level = 'tenant' and slug = 'kassapersoneel-pincodes';
end
$doc$;
