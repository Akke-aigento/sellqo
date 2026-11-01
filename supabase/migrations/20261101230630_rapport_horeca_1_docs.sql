-- RAPPORT-HORECA-1 — nieuw helpartikel "Horecarapporten: Z-archief, export en analyse" op /admin/reports.
-- Categorie a0000001-…-00c (zelfde als rapporten-statistieken, live nagetrokken 01-11-2026).
-- PAS DRAAIEN NA 20261101230620_rapport_horeca_1.sql en NA de publish van de admin.
-- Idempotent via ON CONFLICT (doc_level, slug) DO UPDATE.
-- Handmatig terugdraaien: delete from public.doc_articles where doc_level = 'tenant' and slug = 'horeca-rapporten';
insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, content, tags, context_path, sort_order, is_published)
values (
  'a0000001-0000-0000-0000-00000000000c',
  'tenant',
  'Horecarapporten: Z-archief, export en analyse',
  'horeca-rapporten',
  'Je Z-rapporten terugvinden en afdrukken, ze als CSV aan je boekhouder geven, en zien wat er verkocht wordt, wanneer en door wie.',
  $html$
<p>Met het horecapakket vind je onder <strong>Rapporten › Horeca</strong> alles wat je kassa bijhoudt, voor de periode die je bovenaan de pagina kiest. De periode loopt per bedrijfsdag, met hetzelfde afkapuur als je Z-rapport.</p>

<h2>Z-rapporten</h2>
<ul>
  <li>Elke dagafsluiting van SellQo Kassa staat in de lijst, met nummer, bedrijfsdag en totaal.</li>
  <li>Tik op een rapport om het te bekijken en opnieuw af te drukken of als PDF te bewaren. Het is hetzelfde rapport als op de kassa.</li>
  <li>Met <strong>CSV voor de boekhouder</strong> krijg je één regel per Z-rapport: totaal, maatstaf en btw per tarief, per betaalwijze, afronding, fooien, kas in/uit, annuleringen.</li>
  <li>Werk je met een zwarte doos (geregistreerde kassa), dan is het ondertekende rapport van de kassa het officiële.</li>
</ul>

<h2>Analyse</h2>
<ul>
  <li><strong>Omzet</strong>: alle kassaverkopen, incl. btw. Dat is hetzelfde getal als in je Z-rapporten en op je dashboard.</li>
  <li><strong>Gemiddeld per rekening</strong> en <strong>per couvert</strong>: per couvert telt enkel voor rekeningen waarbij het aantal gasten ingevuld is.</li>
  <li><strong>Toppers</strong>: je best verkochte producten (geannuleerde lijnen tellen niet). De volledige lijst download je met <strong>Productmix als CSV</strong>.</li>
  <li><strong>Omzet per uur</strong> en <strong>per medewerker</strong>, met de fooien per medewerker. Fooien horen niet bij de omzet.</li>
</ul>
<p>Gewerkte uren en de verdeling van de fooienpot vind je onder <strong>Kassa › Personeel</strong>.</p>
$html$,
  array['horeca','kassa','z-rapport','rapporten','export','boekhouder'],
  '/admin/reports',
  20,
  true
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
  tags = excluded.tags, context_path = excluded.context_path, sort_order = excluded.sort_order,
  updated_at = now();
