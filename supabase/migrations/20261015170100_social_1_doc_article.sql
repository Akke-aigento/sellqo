-- SOCIAL-1 — helpartikel "Social posts inplannen en publiceren".
--
-- WAAROM. Tot SOCIAL-1 bestond er geen artikel over social posts: ingeplande posts
-- werden nooit gepubliceerd en Instagram-posts belandden op de Facebook-pagina. Nu
-- dat werkt, moet een tenant weten hoe inplannen, Instagram en de paginakeuze werken,
-- en wat hij doet als een post mislukt.
--
-- Nieuw artikel (geen bestaand artikel over dit onderwerp, nagetrokken op 15 okt 2026:
-- enkel emailcampagnes, ai-functies-overzicht en dagelijkse-menukaart in de buurt).
-- Categorie Marketing (a0000001-0000-0000-0000-00000000000b), context /admin/marketing.
--
-- Idempotent: ON CONFLICT (doc_level, slug) DO UPDATE.
-- Handmatig terugdraaien: DELETE FROM public.doc_articles WHERE doc_level = 'tenant' AND slug = 'social-posts-inplannen';

INSERT INTO public.doc_articles (doc_level, category_id, context_path, title, slug, excerpt, content, sort_order)
VALUES
(
  'tenant',
  'a0000001-0000-0000-0000-00000000000b',
  '/admin/marketing',
  'Social posts inplannen en publiceren',
  'social-posts-inplannen',
  'Zo plan je posts voor Facebook en Instagram in, kies je de juiste pagina en zie je wat er gebeurt als een post niet lukt.',
  $html$<h2>Social posts inplannen en publiceren</h2>
<p>Posts voor Facebook en Instagram kun je meteen plaatsen of inplannen. Ingeplande posts gaan automatisch online, binnen het uur na het tijdstip dat je kiest. Je hoeft SellQo daarvoor niet open te hebben.</p>

<h3>Eerst koppelen</h3>
<p>Ga naar <strong>Instellingen &rarr; Social Media</strong> en koppel je account.</p>
<ul>
<li><strong>Meta (Facebook &amp; Instagram):</strong> post op je Facebook-pagina, en op het professionele Instagram-account dat aan die pagina gekoppeld is.</li>
<li><strong>Instagram:</strong> staat deze kaart in je lijst, dan kun je Instagram ook rechtstreeks koppelen, zonder Facebook-pagina. Bij het inloggen kies je zelf welk Instagram-account bij deze winkel hoort.</li>
</ul>
<p>Beheer je meerdere Facebook-pagina's, dan verschijnt onder de Meta-koppeling een keuzelijst. Kies daar op welke pagina deze winkel post. Zonder keuze plaatst SellQo niets, zodat een post nooit op de verkeerde pagina belandt.</p>

<h3>Wat Instagram verwacht</h3>
<ul>
<li>Elke Instagram-post heeft minstens één beeld. Alleen tekst kan niet.</li>
<li>Beelden moeten <strong>JPEG</strong> zijn (.jpg). PNG of WebP weigert Instagram.</li>
<li>Meerdere beelden worden een carrousel: 2 tot 10 beelden.</li>
<li>Stories kunnen alleen zonder stickers. Een story met een link-, poll- of vraagsticker plaats je zelf in de Instagram-app.</li>
</ul>

<h3>Als een post niet lukt</h3>
<p>Bij een tijdelijk probleem, zoals een storing bij Meta, probeert SellQo het later opnieuw, tot drie keer in totaal. Lukt het dan nog niet, of is er een probleem dat niet vanzelf overgaat (verlopen koppeling, geen beeld, geen pagina gekozen), dan krijg je een melding met de reden en staat de post op <strong>Mislukt</strong>. Los de oorzaak op en plan de post opnieuw in.</p>
<p>Krijg je de melding dat een publicatie werd onderbroken? Kijk dan eerst op Instagram of Facebook of de post toch online staat, voor je hem opnieuw inplant. Zo voorkom je een dubbele post.</p>

<h3>Je koppeling blijft vanzelf geldig</h3>
<p>Een rechtstreekse Instagram-koppeling is 60 dagen geldig en wordt automatisch verlengd zolang hij actief is. Zie je toch <strong>Verlopen</strong> staan, klik dan op <strong>Vernieuwen</strong>.</p>$html$,
  4
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  updated_at = now();
