-- WERKPLEK-1 — helpartikels.
--   1. Nieuw: "Je horeca-werkplek: wat staat waar" (tenant, /admin/bestellen).
--   2. "Kassa (POS) gebruiken": één alinea erbij voor horecawinkels zonder webshop.
-- PAS DRAAIEN NA de publish van de admin (anders beschrijft het artikel een menu dat nog niet bestaat).
--
-- Idempotent: (1) ON CONFLICT DO NOTHING; (2) replace() met md5-guard op de live tekst van
-- 28-10-2026 (ca9456788bb3a96941f0a2b81a183189); na de eerste run matcht de guard niet meer.
-- Handmatig terugdraaien:
--   delete from public.doc_articles where doc_level = 'tenant' and slug = 'horeca-werkplek';
--   update public.doc_articles d set content = s.content
--     from snapshots.sellqo_20261028_doc_articles_werkplek1 s where d.id = s.id;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261028_doc_articles_werkplek1 as
  select * from public.doc_articles where doc_level = 'tenant' and slug = 'pos-gebruiken';
revoke all on snapshots.sellqo_20261028_doc_articles_werkplek1 from anon, authenticated;

insert into public.doc_articles (doc_level, slug, title, excerpt, content, context_path, category_id, sort_order, is_published)
values (
  'tenant',
  'horeca-werkplek',
  'Je horeca-werkplek: wat staat waar',
  'Met een horecapakket zonder webshop zie je enkel wat een zaak nodig heeft. Zo vind je alles terug.',
  $c$<h2>Je horeca-werkplek</h2>
<p>Heb je een horecapakket zonder webshop- of eventspakket, dan toont SellQo in het menu en in de instellingen enkel wat een zaak nodig heeft.</p>
<h3>In het menu</h3>
<ul>
<li><strong>Dashboard</strong>: je dag in één oogopslag, met wat er in de keuken klaarstaat.</li>
<li><strong>Bestellingen</strong>: alle bestellingen, van de kassa, de QR-code aan tafel en online.</li>
<li><strong>Kassa</strong>: hier maak je je kassa's aan en beheer je je personeel en pincodes. Een kassa openen gaat altijd naar SellQo Kassa.</li>
<li><strong>Bestellen</strong>: je kaart (hier beheer je al je producten en categorieën), extra's en allergenen, je QR-menu, je zaalplan en je posten (bar, keuken).</li>
<li><strong>Keuken</strong>: het keukenscherm. Kies per scherm welke post het toont.</li>
<li><strong>Betalingen</strong>, <strong>Rapporten</strong>, <strong>Inkoop</strong>, <strong>Instellingen</strong> en <strong>Help</strong>.</li>
</ul>
<h3>Op je gsm</h3>
<p>Onderaan staan Dashboard, Bestellingen, Bestellen (je kaart) en Keuken.</p>
<h3>Wat je niet ziet</h3>
<p>Klanten, kortingen, e-mailmarketing, media, vertalingen, retouren en reviews horen bij een webshop. Neem je er een webshop- of eventspakket bij, dan verschijnen ze vanzelf.</p>$c$,
  '/admin/bestellen',
  'a0000001-0000-0000-0000-000000000006',
  1,
  true
)
on conflict (doc_level, slug) do nothing;

update public.doc_articles
   set content = content || $p$<h3>Horeca zonder webshop</h3><p>Heb je een horecapakket zonder webshop, dan opent een kassa altijd <strong>SellQo Kassa</strong>, met tafels, rekeningen en de toog. Op deze pagina maak je je kassa's aan, zie je welke toestellen verbonden zijn en beheer je je personeel.</p>$p$
 where doc_level = 'tenant'
   and slug = 'pos-gebruiken'
   and md5(content) = 'ca9456788bb3a96941f0a2b81a183189';
