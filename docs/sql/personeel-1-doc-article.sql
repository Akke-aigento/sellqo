-- PERSONEEL-1 — helpartikel "Kassapersoneel en pincodes". Live gedraaid op 24-10-2026 (go Akke);
-- draaien via query_database na de go op PERSONEEL-1. Idempotent via (doc_level, slug).
insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, content, tags, context_path, sort_order, is_published)
values (
  'a0000001-0000-0000-0000-000000000006',
  'tenant',
  'Kassapersoneel, pincodes en in- en uitklokken',
  'kassapersoneel-pincodes',
  'Voeg medewerkers toe met een pincode, laat ze aanmelden op SellQo Kassa en in- en uitklokken.',
  $html$
<p>Onder <strong>Kassa › Personeel</strong> beheer je wie aan de kassa werkt. Dat staat los van je SellQo-gebruikers: een ober heeft geen eigen login nodig, enkel een pincode.</p>

<h2>Een medewerker toevoegen</h2>
<ol>
  <li>Klik op <strong>Medewerker toevoegen</strong>.</li>
  <li>Vul de naam in zoals die op de kassa moet staan, kies een rol en eventueel een nummer (leeg = volgend vrij nummer).</li>
  <li>Kies een pincode van 4 tot 6 cijfers. Je kan die later vervangen, maar nooit meer bekijken.</li>
</ol>

<h2>Aanmelden op de kassa</h2>
<ul>
  <li>Open <strong>SellQo Kassa</strong> of ga in je browser naar <code>/kassa</code>. Meld het toestel één keer aan met je SellQo-account en kies welke kassa het is.</li>
  <li>Daarna kiest elke medewerker zijn naam en tikt zijn pincode. Na twee minuten zonder tikken vergrendelt de kassa vanzelf; met <strong>Wissel</strong> geef je de kassa meteen door.</li>
  <li>Vijf foute pincodes na elkaar blokkeren die medewerker vijf minuten. Een nieuwe pincode instellen heft de blokkering op.</li>
</ul>

<h2>In- en uitklokken</h2>
<p>Op het startscherm van de kassa klokt een medewerker in en uit. Aanmelden met je pincode is geen inklokken: dat zijn twee aparte handelingen.</p>

<h2>Rijksregisternummer (geregistreerde kassa)</h2>
<p>Een geregistreerde kassa (GKS, met zwarte doos) moet elke handeling koppelen aan het rijksregisternummer van de medewerker. Vul het in bij de medewerker. Het wordt versleuteld bewaard, enkel naar de zwarte doos gestuurd en komt nooit op een ticket of scherm. Zonder geregistreerde kassa is het niet nodig.</p>
$html$,
  array['kassa','personeel','pincode','inklokken','gks'],
  '/admin/pos',
  5,
  true
)
on conflict (doc_level, slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
  tags = excluded.tags, context_path = excluded.context_path, sort_order = excluded.sort_order,
  updated_at = now();
