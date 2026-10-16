-- MEDIA-1 / PHOTO-STD-1 / EDITOR-2 — helpartikel "Productfoto's: mediabibliotheek, fotostandaard en bewerken".
-- Nieuw artikel (er bestond er nog geen over de mediabibliotheek of het fotoformaat; nagelezen
-- via query_database op 16-10-2026). Categorie Producten, contextuele hulp op /admin/products.
--
-- PAS DRAAIEN NA 20261016190000_media_1_one_library.sql en
-- 20261016191000_photo_std_1_tenant_media_settings.sql, anders belooft het artikel iets dat de
-- database nog niet doet.
--
-- Idempotent via ON CONFLICT (doc_level, slug) DO UPDATE.
-- Handmatig terugdraaien: delete from public.doc_articles where doc_level = 'tenant' and slug = 'productfotos-mediabibliotheek-fotostandaard';

insert into public.doc_articles (category_id, doc_level, title, slug, excerpt, content, tags, context_path, sort_order, is_published)
values (
  'a0000001-0000-0000-0000-000000000001',
  'tenant',
  'Productfoto''s: mediabibliotheek, fotostandaard en bewerken',
  'productfotos-mediabibliotheek-fotostandaard',
  'Al je foto''s op één plek, elke productfoto automatisch in dezelfde vorm, en gratis bijsnijden, draaien en de achtergrond aanpassen.',
  $doc$<h2>Al je foto's in één mediabibliotheek</h2>
<p>Elke foto die je oplaadt komt automatisch in je mediabibliotheek: in een product, een variant, een categorie of rechtstreeks in de bibliotheek. Ook foto's die je vroeger al aan producten hing, staan er nu in. Je vindt de bibliotheek onder <strong>Producten → Foto's</strong> (fotobibliotheek) en onder <strong>Marketing → AI Content Hub → Assets</strong>.</p>
<p>Bij elke foto zie je op welk product ze staat. Een foto die op een product staat, kun je niet uit de bibliotheek verwijderen: haal ze eerst van het product.</p>

<h2>Foto's op een externe server</h2>
<p>Heb je producten geïmporteerd uit Shopify, dan worden sommige foto's nog geladen vanaf de server van Shopify. Zeg je dat oude abonnement op, dan verdwijnen ze uit je webshop. In de mediabibliotheek (Assets) zie je dan een gele melding met het aantal. Klik op <strong>Naar eigen opslag halen</strong>: SellQo haalt elke foto één keer op en vervangt het adres in je producten, varianten en categorieën. Het beeld zelf verandert niet. Laat het venster open tot het klaar is; een foto die niet opgehaald kan worden, blijft gewoon staan zoals ze was en staat in de lijst onder de melding.</p>

<h2>Fotostandaard: alle productfoto's in dezelfde vorm</h2>
<p>Elke plek in je webshop heeft een vaste vorm. Een foto in een andere vorm wordt bijgesneden of krijgt lege randen, waardoor producten ongelijk groot ogen. Met de fotostandaard leg je één vorm vast, bijvoorbeeld staand 3:4 op 1200 × 1600 pixels. Je stelt ze in onder <strong>Producten → Foto's → Fotostandaard</strong>:</p>
<ul>
<li><strong>Verhouding en formaat</strong>: de vorm van het resultaat.</li>
<li><strong>Achtergrond</strong>: automatisch (de randkleur van de foto), wit, zwart, transparant of een eigen kleur.</li>
<li><strong>Ruimte rond het product</strong>: hoeveel lege ruimte er rond het product blijft.</li>
<li><strong>Lege rand wegknippen</strong>: werkt alleen bij een effen achtergrond. Het product zelf wordt nooit bijgesneden.</li>
<li><strong>Voorstellen bij uploaden</strong>: voeg je een foto toe aan een product, dan zie je eerst het resultaat naast het origineel en kies je per foto welke versie je gebruikt.</li>
</ul>
<p>Het voorbeeld rechts toont meteen hoe een van je eigen productfoto's eruit zal zien. Staat de fotostandaard uit, dan verandert er niets aan je foto's.</p>
<p>Bestaande foto's zet je in bulk om: kies onder <strong>Fotobeheer</strong> de filter <strong>Afwijkend formaat</strong>, selecteer de foto's en klik op <strong>Standaardiseren</strong>. Het origineel blijft in je mediabibliotheek staan.</p>
<p><strong>Tip:</strong> zet één product per foto. Voor- en achterkant naast elkaar op één beeld passen niet in een staand vak; maak daar twee aparte foto's van.</p>

<h2>Een foto bewerken</h2>
<p>Klik op een productfoto op <strong>Bewerken</strong>. In het tabblad <strong>Formaat &amp; uitsnede</strong> (gratis) kies je de verhouding en de achtergrond, zoom je in of uit, verschuif je het product en draai je de foto. In het tabblad <strong>AI-achtergrond</strong> laat je AI de achtergrond vervangen; dat kost AI-credits. Elke bewerking wordt een nieuwe foto: het origineel blijft in je mediabibliotheek.</p>$doc$,
  array['foto''s','mediabibliotheek','fotostandaard','afbeeldingen','producten','shopify'],
  '/admin/products',
  2,
  true
)
on conflict (doc_level, slug) do update
  set title = excluded.title,
      excerpt = excluded.excerpt,
      content = excluded.content,
      tags = excluded.tags,
      context_path = excluded.context_path,
      category_id = excluded.category_id;
