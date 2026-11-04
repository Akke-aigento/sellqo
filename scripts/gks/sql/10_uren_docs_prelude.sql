-- UREN-1c — wegwerp-doc_articles voor de docs-migraties van UREN-1/1b (20261104120100, 20261104120300).
-- Enkel de kolommen die die migraties gebruiken. De inhoud draagt elk anker zoals het live staat (live op
-- 4-11-2026 nageteld: elk anker precies één keer, nog geen "<li><strong>Website</strong>:"), met wat tekst
-- errond. run.sh draait de migraties twee keer en vergelijkt de md5 per artikel (test_uren_docs.sql).
create table if not exists public.doc_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid,
  doc_level text not null,
  title text not null,
  slug text not null,
  excerpt text,
  context_path text,
  sort_order integer default 0,
  is_published boolean default true,
  tags text[],
  content text,
  updated_at timestamptz default now(),
  unique (doc_level, slug)
);
create table if not exists public.uren_docs_md5 (run int, slug text, md5 text);
insert into public.doc_articles (doc_level, title, slug, content) values
 ('tenant', 'Reservaties', 'reservaties',
  '<h2>Online reserveren</h2><ul>
  <li>per weekdag het eerste en het laatste aankomstuur (dagen zonder uren zijn online dicht; je sluitingsdagen gelden ook);</li>
  <li>om de hoeveel minuten gasten kunnen aankomen;</li>
</ul>'),
 ('tenant', 'Je horeca-werkplek', 'horeca-werkplek',
  '<h3>Beheer</h3>
<ul>
<li><strong>Kaart</strong>: al je producten.</li>
<li><strong>Betalingen</strong>, <strong>Rapporten</strong> en <strong>Inkoop</strong> (leveranciers en hun facturen).</li>
</ul>'),
 ('tenant', 'Theme aanpassen', 'theme-aanpassen',
  '<h2>Theme aanpassen</h2><p>Ga naar <strong>Webshop</strong> om het uiterlijk van je shop in te stellen.</p><h3>Wat kan je aanpassen?</h3><ul><li><strong>Kleuren</strong> — primaire kleur, accenten en achtergronden, afgestemd op je huisstijl</li><li><strong>Lettertypen</strong> — webfonts</li><li><strong>Logo &amp; favicon</strong> — upload je eigen logo</li></ul>'),
 ('tenant', 'E-mailcampagnes versturen', 'emailcampagnes',
  '<h2>Je logo in je mails</h2><p>Upload je je logo bij <strong>Instellingen → Branding</strong> of in je webshopthema, dan maakt SellQo er een versie voor e-mails van.</p>')
on conflict (doc_level, slug) do nothing;
