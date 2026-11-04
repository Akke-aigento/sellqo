-- UREN-1b — helpartikels voor logo en merkkleur op één plek (Instellingen › Branding) en de horecathema's.
--   1. Nieuw: "Logo en merkkleur" (logo-en-merkkleur), context_path Instellingen › Branding.
--   2. theme-aanpassen: kleuren en logo staan in Branding; horecathema's (Menukaart, Bezoek ons, …).
--   3. emailcampagnes: het logo upload je enkel nog in Branding.
-- Live nagetrokken op 4-11-2026 (read-only): elk anker hieronder komt precies één keer voor; md5 vooraf
-- emailcampagnes 1de687d66b7384c131884722650be08f. Categorie a0000001-…006 (Webshop) bestaat live.
-- Draaien NA 20261104120100_uren_1_docs.sql (die past theme-aanpassen ook aan, op een ander anker) en na de
-- publish van sellqo.app.
-- Idempotent: nieuw artikel via ON CONFLICT (doc_level, slug) DO UPDATE; replace() enkel als het anker precies
-- één keer voorkomt. Snapshot vooraf, één keer.
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content from snapshots.sellqo_20261104_doc_uren_1b s where d.id = s.id;
--   update public.doc_articles set is_published = false where doc_level = 'tenant' and slug = 'logo-en-merkkleur';

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261104_doc_uren_1b as
  select id, doc_level, slug, title, excerpt, tags, content, md5(content) as md5, now() as taken_at
    from public.doc_articles where doc_level = 'tenant' and slug in ('theme-aanpassen', 'emailcampagnes');
revoke all on snapshots.sellqo_20261104_doc_uren_1b from anon, authenticated;

insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, context_path, sort_order, is_published, tags, content)
values (
  'a0000001-0000-0000-0000-000000000006', 'tenant',
  'Logo en merkkleur instellen',
  'logo-en-merkkleur',
  'Je logo, favicon en merkkleur stel je op één plek in: Instellingen › Branding. Ze gelden voor je website, je mails, facturen en kassabonnen.',
  '/admin/settings?section=branding', 4, true, array['logo', 'merkkleur', 'branding', 'favicon', 'huisstijl'],
  $doc$<p>Je logo, favicon en merkkleur staan op één plek: <strong>Instellingen › Branding</strong>. Dat kan in elk abonnement; enkel de zaakvoerder kan ze aanpassen.</p>

<h2>Waar ze gebruikt worden</h2>
<ul>
  <li>op je website (<em>jouwzaak</em>.sellqo.shop): logo bovenaan, favicon in het tabblad, merkkleur voor knoppen en links;</li>
  <li>in je mails aan klanten (SellQo maakt automatisch een bijgesneden e-mailversie van je logo);</li>
  <li>op je facturen, creditnota's en betaalverzoeken, en op je kassabon.</li>
</ul>

<h2>Instellen</h2>
<ol>
  <li>Upload je logo en eventueel een favicon.</li>
  <li>Kies je <strong>Merkkleur</strong>: een van de voorbeeldkleuren, een eigen kleurcode, of <strong>Kleur uit mijn logo halen</strong>.</li>
  <li>Klik op <strong>Opslaan</strong>.</li>
</ol>
<p>In <strong>Website › Aanpassen</strong> (tab <em>Thema</em>) en bij je <strong>Bedrijfsgegevens</strong> zie je je logo en kleur, met een link naar Branding. Kies je in Aanpassen een ander thema, dan blijft je merkkleur staan, tenzij je <em>Ook de merkkleur van het thema overnemen</em> aanvinkt.</p>
<p>Gebruiken je facturen of mails vandaag een ander logo of een andere kleur dan je website, dan zie je dat bovenaan Branding. Sla je op, dan krijgen ze allemaal hetzelfde logo en dezelfde kleur.</p>
<p>Heb je een eigen website (eigen frontend)? Dan blijft Branding werken zoals voorheen, met een merkkleur en een aparte primaire kleur.</p>$doc$
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, context_path = excluded.context_path, sort_order = excluded.sort_order,
  is_published = excluded.is_published, tags = excluded.tags, content = excluded.content, category_id = excluded.category_id;

update public.doc_articles
   set content = replace(replace(content,
         '<li><strong>Kleuren</strong> — primaire kleur, accenten en achtergronden, afgestemd op je huisstijl</li>',
         '<li><strong>Kleuren</strong> — achtergrond en tekst komen uit je thema; je merkkleur (knoppen en links) stel je in onder <strong>Instellingen › Branding</strong></li>'),
         '<li><strong>Logo &amp; favicon</strong> — upload je eigen logo</li>',
         '<li><strong>Logo &amp; favicon</strong> — onder <strong>Instellingen › Branding</strong>, één plek voor je website, mails, facturen en kassabonnen</li>
<li><strong>Horecathema''s</strong> — Restaurant &amp; afhaal, Bar &amp; café en Restaurant &amp; bistro spreken van Menukaart, Reserveren en Bezoek ons in plaats van producten en shop. Met een horecapakket staan ze vooraan bij <em>Thema kiezen</em>. Je thema verandert nooit vanzelf.</li>'),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'theme-aanpassen'
   and (length(content) - length(replace(content, '<li><strong>Logo &amp; favicon</strong> — upload je eigen logo</li>', '')))
       = length('<li><strong>Logo &amp; favicon</strong> — upload je eigen logo</li>')
   and (length(content) - length(replace(content, '<li><strong>Kleuren</strong> — primaire kleur, accenten en achtergronden, afgestemd op je huisstijl</li>', '')))
       = length('<li><strong>Kleuren</strong> — primaire kleur, accenten en achtergronden, afgestemd op je huisstijl</li>');

update public.doc_articles
   set content = replace(content,
         'Upload je je logo bij <strong>Instellingen → Branding</strong> of in je webshopthema, dan',
         'Upload je je logo bij <strong>Instellingen → Branding</strong> (de enige plek voor je logo), dan'),
       updated_at = now()
 where doc_level = 'tenant' and slug = 'emailcampagnes'
   and (length(content) - length(replace(content, 'Upload je je logo bij <strong>Instellingen → Branding</strong> of in je webshopthema, dan', '')))
       = length('Upload je je logo bij <strong>Instellingen → Branding</strong> of in je webshopthema, dan');
