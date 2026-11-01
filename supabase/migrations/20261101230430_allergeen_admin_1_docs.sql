-- ALLERGEEN-ADMIN-1 — helpartikel over allergenen: "geen" vs "niet ingevuld".
--
-- Live nagetrokken (01-11-2026, read-only): er bestaat nog geen apart allergenen-artikel (enkel
-- vermeldingen in horeca-kaart en horeca-werkplek). Daarom een nieuw tenant-artikel
-- 'allergenen-invullen' (context /admin/bestellen, waar de Kaart en de allergenenkaart staan).
-- Vereist dat 20261101230340_allergeen_verklaard_1.sql gedraaid is en de admin gepubliceerd
-- (anders beschrijft het artikel een vinkje dat er nog niet staat).
--
-- Idempotent: snapshot van een eventueel bestaande rij met deze slug (vandaag geen), dan
-- INSERT ... ON CONFLICT (doc_level, slug) DO UPDATE.
-- Handmatig terugdraaien:
--   delete from public.doc_articles where doc_level = 'tenant' and slug = 'allergenen-invullen'
--     and not exists (select 1 from snapshots.sellqo_20261101_doc_articles_allergeen_admin1);
--   (bestond er wel een rij: terugzetten uit snapshots.sellqo_20261101_doc_articles_allergeen_admin1)

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261101_doc_articles_allergeen_admin1 as
  select * from public.doc_articles where doc_level = 'tenant' and slug = 'allergenen-invullen';
revoke all on snapshots.sellqo_20261101_doc_articles_allergeen_admin1 from anon, authenticated;

insert into public.doc_articles (doc_level, slug, title, excerpt, content, context_path, category_id, sort_order, tags, is_published)
values (
  'tenant',
  'allergenen-invullen',
  'Allergenen invullen: "geen" is iets anders dan "niet ingevuld"',
  'Vink per gerecht de allergenen aan, of "Bevat geen van de 14 allergenen". Een gerecht waar niets is ingevuld, krijgt op het QR-menu een waarschuwing.',
  $c$<h2>Waar vul je de allergenen in?</h2>
<p>Open een product op de <strong>Kaart</strong> en klap <strong>Extra's en allergenen</strong> open, of gebruik het productformulier. Daar vink je aan welke van de 14 allergenen (EU-verordening 1169/2011) in het gerecht zitten.</p>

<h2>"Bevat geen van de 14 allergenen"</h2>
<p>Zit er geen enkel allergeen in, vink dan <strong>Bevat geen van de 14 allergenen</strong> aan. Dat vinkje is nodig omdat een lege lijst twee dingen kan betekenen: "dit gerecht bevat niets" of "dit is nog niet ingevuld". Voor een gast met een allergie is dat verschil belangrijk, dus SellQo beweert nooit dat een gerecht allergeenvrij is zolang jij dat niet zelf hebt vastgelegd. Twijfel je, vraag het na bij je leverancier.</p>
<p>Een product kent zo drie standen, die je op de Kaart ziet bij <em>Extra's en allergenen</em>: het aantal allergenen, <strong>geen allergenen</strong>, of <strong>allergenen niet ingevuld</strong>. Zolang een gerecht op "niet ingevuld" staat, toont het QR-menu de gast een waarschuwing dat de allergenen niet ingevuld zijn, in plaats van niets (wat als "bevat niets" gelezen zou worden). Maak je een kopie of een nieuwe maat van een product, dan neemt die de allergenen en het vinkje mee.</p>

<h2>Wat moet je nog doen?</h2>
<ul>
  <li>Bovenaan de <strong>Kaart</strong> staat hoeveel producten nog niet ingevuld zijn; tik erop om de lijst te zien.</li>
  <li>Onder <strong>Kaart › Instellen › Allergenen</strong> staat de allergenenkaart van al je gerechten en extra's. Gerechten die nog niet ingevuld zijn, staan daar in een lijst <strong>Nog in te vullen</strong>; tik op een naam om het product te openen.</li>
  <li>Druk de allergenenkaart af voor in de zaak: in België moet de allergeneninformatie ook ter plaatse beschikbaar zijn. Gerechten zonder allergenen staan erop als "geen allergenen", gerechten die nog niet ingevuld zijn als "niet ingevuld".</li>
</ul>
<p>Extra's (zoals een saus of topping) hebben geen apart vinkje: vink daar enkel de allergenen aan die erin zitten.</p>$c$,
  '/admin/bestellen',
  'a0000001-0000-0000-0000-000000000006',
  8,
  array['horeca', 'allergenen', 'allergie', 'kaart', 'qr-menu'],
  true
)
on conflict (doc_level, slug) do update
  set title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
      context_path = excluded.context_path, tags = excluded.tags, updated_at = now();
